# Hierarchy

This module models a forest as two parallel arrays in depth-first traversal order: node IDs and node depths. `Hierarchy.filter` keeps a node only when its own predicate and every ancestor's predicate pass. A failed node removes its complete subtree without evaluating descendants, while later siblings and later roots are processed independently.

The implementation makes one iterative pass over the hierarchy. It stores one inclusion flag per active depth, growing that state array geometrically as needed, so filtering takes `O(n)` time and `O(d + n)` space including the result, where `d` is the maximum depth. Iteration avoids call-stack growth on deeply nested input. Input arrays are copied and validated; this implementation assumes node IDs are unique within the forest.

Run the tests with Java 21:

```bash
./gradlew test
```

On Windows:

```powershell
.\gradlew.bat test
```

The public API was reconstructed because the employer-provided Kotlin stub was not present. If the original stub uses different method names or types, adapt this module to that contract before submission.
