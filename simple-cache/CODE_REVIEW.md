# SimpleCache Production Code Review

## Executive Summary

`SimpleCache` is not production-ready for the stated workload. Expired entries remain strongly referenced, live entries have no capacity bound, and nullable generic types make cache-miss results ambiguous for nullable values. The first two confirmed behaviors can exhaust heap under a growing key set. `size()` reports resident map entries (including expired entries) and is not an exact snapshot during concurrent updates. TTL decisions also depend on wall-clock corrections.

This review examines the original `SimpleCache.kt` source in this repository. The findings below are based on its implementation and the workload assumptions listed here.

## Assumed Workload and Review Scope

- Thousands of reads per second, hundreds of writes per second, and tens of concurrent threads.
- One in-process cache instance; no distributed coherence requirement.
- TTL means fixed expiration after `put`, not sliding expiration after `get`.
- The implementation does not state a non-null key/value contract; this is reviewed as an open API issue in SC-05.
- Review covers correctness, memory bounds, concurrency, API semantics, performance, and operability.

## Confirmed Findings

### SC-01 - Expired entries are never evicted

**Severity:** High  
**Category:** Memory / Correctness

**Problem:** `get` returns `null` for an expired entry but leaves it in `cache`.

**Evidence:** `SimpleCache.kt:13-20` returns `null` for an expired entry but never removes it.

**Production Impact:** Expired keys and values remain strongly referenced. A workload that continually introduces keys can retain all historical values and eventually trigger long garbage-collection pauses or `OutOfMemoryError`.

**Recommendation:** Prefer Caffeine with `expireAfterWrite`. If a custom cache is required, remove an expired entry with `cache.remove(key, entry)` during reads and add bounded maintenance for entries that are never read again.

**Verification:** Use a fake ticker, insert many short-lived entries, advance time, run maintenance, and assert both logical size and retained entry count return to the expected bound.

### SC-02 - The cache has no capacity bound

**Severity:** High  
**Category:** Memory

**Problem:** Every distinct key is accepted and there is no maximum size, weight, or eviction policy.

**Evidence:** `SimpleCache.kt:9-10` writes every key directly to the map. The class has no capacity configuration or eviction code.

**Production Impact:** A large or adversarial key space can consume all available heap even when entries have not expired. Concurrent map resizing also adds latency and allocation pressure as the cache grows.

**Recommendation:** Configure a measured maximum size or weight and an explicit eviction policy. Caffeine provides concurrent bounded eviction and should be preferred to a custom LRU implementation.

**Verification:** Insert more unique keys than the configured bound under concurrent load and assert the retained size remains bounded without corrupting live values.

### SC-03 - `size()` includes expired entries

**Severity:** Medium  
**Category:** Correctness / API

**Problem:** `size()` counts resident map entries, not necessarily readable entries. It can include expired entries and, like `ConcurrentHashMap.size`, is not an exact snapshot while concurrent updates are in progress.

**Evidence:** `SimpleCache.kt:23-25` returns `cache.size`; expiration in `SimpleCache.kt:15-20` does not remove entries.

**Production Impact:** Callers may treat resident count as live-entry count and misinterpret capacity or health data. Stale-entry accumulation is independently covered by SC-01.

**Recommendation:** Document this as resident-entry count, or provide separately named/defined live and resident-size metrics if callers need both.

**Verification:** Expire an entry without reading it and verify the documented resident-size behavior; exercise concurrent updates if callers require stronger size guarantees.

### SC-04 - TTL uses wall-clock time

**Severity:** Medium  
**Category:** Correctness

**Problem:** Expiration uses `System.currentTimeMillis()`, which is not monotonic.

**Evidence:** `SimpleCache.kt:10` records wall-clock creation time and line 16 subtracts another wall-clock reading.

**Production Impact:** A backward clock adjustment extends entry lifetime; a forward adjustment expires entries early. This is operationally plausible with host clock synchronization or manual correction.

**Recommendation:** Inject a monotonic ticker based on `System.nanoTime()` and store deadlines or elapsed durations. Injection also makes boundary tests deterministic.

**Verification:** Use a fake ticker to simulate forward progress and wall-clock jumps; TTL decisions should depend only on monotonic elapsed time.

### SC-05 - Nullable values make cache misses ambiguous

**Severity:** Medium  
**Category:** Correctness / API

**Problem:** `K` and `V` have no non-null upper bounds, so nullable type arguments are allowed. A nullable value can be stored, but `get` returns `null` both for that hit and for a miss. A null key reaches `ConcurrentHashMap`, which rejects it with `NullPointerException`.

**Evidence:** `SimpleCache.kt:3` declares unbounded `K` and `V`; `put` accepts `V` at line 9 and `get` returns `V?` at line 13.

**Production Impact:** Callers using nullable type arguments cannot distinguish a cached null from a cache miss. Passing a null key fails at runtime rather than being rejected by the API contract.

**Recommendation:** Either constrain keys and values to non-null types (`K : Any, V : Any`) or define explicit nullable-value semantics, such as a distinct lookup result type. Document or explicitly reject null keys.

**Verification:** Add tests for nullable type arguments and null keys, or compile-time/API checks if the contract is changed to non-null types.

## Conditional Risks and Open Questions

- Concurrent `put` operations use last-writer-wins. Confirm whether compare-and-set, version checks, or loader deduplication are required.
- Fixed TTL is implemented. Sliding TTL would add a write on reads and change contention and expiry semantics; choose it only from product requirements.
- The public API has no invalidation or metrics methods. Whether those are required depends on the caller contract; add them only if use cases require explicit invalidation or in-process cache telemetry.
- The cache stores `V` by reference. `ConcurrentHashMap` protects map operations, not mutable objects stored as values. The ownership and mutation contract for `V` must be documented; defensive copying is domain-specific.
- There is no loader API, so cache stampede prevention is outside the current contract. If loading is added, concurrent misses for one key should be coalesced.

## Recommendations by Priority

1. Replace the custom implementation with Caffeine configured with `maximumSize` or `maximumWeight`, `expireAfterWrite`, and statistics if operationally useful.
2. If custom code is mandatory, add bounded eviction and maintenance for expired entries that are never read; compare-and-remove expired entries on reads to avoid deleting a concurrently replaced value.
3. Use an injected monotonic ticker and define fixed versus sliding TTL, overwrite behavior, nullability, `size()` semantics, and mutable-value ownership in the API contract.
4. Add invalidation and vendor-neutral metrics if required by the cache's callers and operational environment.

## Verification and Testing Strategy

- Deterministic unit tests with a fake monotonic ticker at `ttl - 1`, `ttl`, and `ttl + 1`.
- Capacity and eviction-order tests with overwrites and repeated reads.
- Concurrent same-key and many-key tests using barriers rather than sleeps.
- Nullable key/value contract tests, or compile-time/API checks enforcing non-null types.
- A sustained load test matching the expected read/write ratio while monitoring heap, allocation rate, latency percentiles, hit rate, and retained entry count.
- Long-running expiration tests proving entries that are never read are still reclaimed.
- Java interop tests if Java callers are supported.

## Conclusion

The map choice alone does not make this a production cache. Expiration without reclamation and unlimited admission are the release-blocking findings. Nullable value semantics also need to be resolved before callers rely on miss detection. A proven cache library is the lowest-risk recommendation; a custom implementation needs explicit memory bounds, monotonic time, maintenance, and concurrency-focused verification.
