package com.tempo.hierarchy

import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class ArrayBasedHierarchyTest {
    @Test
    fun `empty hierarchy stays empty`() {
        val result = hierarchy().filter { true }

        assertEquals(0, result.size)
        assertContentEquals(intArrayOf(), result.nodeIds())
        assertContentEquals(intArrayOf(), result.depths())
    }

    @Test
    fun `all matching nodes retain DFS order and depths`() {
        val source = hierarchy(
            ids = intArrayOf(1, 2, 3, 4),
            depths = intArrayOf(0, 1, 2, 0),
        )

        val result = source.filter { true }

        assertContentEquals(intArrayOf(1, 2, 3, 4), result.nodeIds())
        assertContentEquals(intArrayOf(0, 1, 2, 0), result.depths())
    }

    @Test
    fun `no matching roots produce an empty result`() {
        val source = hierarchy(
            ids = intArrayOf(1, 2, 3),
            depths = intArrayOf(0, 1, 2),
        )

        val evaluated = mutableListOf<Int>()
        val result = source.filter {
            evaluated += it
            false
        }

        assertContentEquals(intArrayOf(), result.nodeIds())
        assertEquals(listOf(1), evaluated)
    }

    @Test
    fun `failed parent removes its subtree but not a later sibling`() {
        val source = hierarchy(
            ids = intArrayOf(1, 2, 3, 4, 5),
            depths = intArrayOf(0, 1, 2, 1, 2),
        )

        val result = source.filter { it != 2 }

        assertContentEquals(intArrayOf(1, 4, 5), result.nodeIds())
        assertContentEquals(intArrayOf(0, 1, 2), result.depths())
    }

    @Test
    fun `failed leaf is removed without affecting its sibling or later root`() {
        val source = hierarchy(
            ids = intArrayOf(1, 2, 3, 4, 5),
            depths = intArrayOf(0, 1, 2, 1, 0),
        )
        val evaluated = mutableListOf<Int>()

        val result = source.filter {
            evaluated += it
            it != 3
        }

        assertContentEquals(intArrayOf(1, 2, 4, 5), result.nodeIds())
        assertContentEquals(intArrayOf(0, 1, 1, 0), result.depths())
        assertEquals(listOf(1, 2, 3, 4, 5), evaluated)
    }

    @Test
    fun `each root in a forest is evaluated independently`() {
        val source = hierarchy(
            ids = intArrayOf(1, 2, 5, 6, 7, 8, 9, 10, 11),
            depths = intArrayOf(0, 1, 1, 0, 1, 0, 1, 1, 2),
        )
        val retained = setOf(1, 2, 5, 8, 10, 11)

        val result = source.filter(retained::contains)

        assertContentEquals(intArrayOf(1, 2, 5, 8, 10, 11), result.nodeIds())
        assertContentEquals(intArrayOf(0, 1, 1, 0, 1, 2), result.depths())
    }

    @Test
    fun `deep hierarchy is filtered without recursion`() {
        val count = 100_000
        val source = hierarchy(
            ids = IntArray(count) { it + 1 },
            depths = IntArray(count) { it },
        )

        val result = source.filter { true }

        assertEquals(count, result.size)
        assertEquals(count, result.nodeIdAt(count - 1))
        assertEquals(count - 1, result.depthAt(count - 1))
    }

    @Test
    fun `constructor defensively copies input arrays`() {
        val ids = intArrayOf(1, 2)
        val depths = intArrayOf(0, 1)
        val source = hierarchy(ids, depths)

        ids[0] = 99
        depths[1] = 0

        assertContentEquals(intArrayOf(1, 2), source.nodeIds())
        assertContentEquals(intArrayOf(0, 1), source.depths())
    }

    @Test
    fun `invalid hierarchy representation is rejected`() {
        assertFailsWith<IllegalArgumentException> {
            hierarchy(intArrayOf(1), intArrayOf())
        }
        assertFailsWith<IllegalArgumentException> {
            hierarchy(intArrayOf(1), intArrayOf(1))
        }
        assertFailsWith<IllegalArgumentException> {
            hierarchy(intArrayOf(1, 2), intArrayOf(0, 2))
        }
        assertFailsWith<IllegalArgumentException> {
            hierarchy(intArrayOf(1, 1), intArrayOf(0, 0))
        }
    }

    private fun hierarchy(
        ids: IntArray = intArrayOf(),
        depths: IntArray = intArrayOf(),
    ): Hierarchy = ArrayBasedHierarchy(ids, depths)
}
