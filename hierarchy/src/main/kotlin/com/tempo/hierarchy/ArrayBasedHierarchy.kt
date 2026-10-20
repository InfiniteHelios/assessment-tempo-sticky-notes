package com.tempo.hierarchy

class ArrayBasedHierarchy(
    nodeIds: IntArray,
    depths: IntArray,
) : Hierarchy {
    private val storedNodeIds = nodeIds.copyOf()
    private val storedDepths = depths.copyOf()

    init {
        require(storedNodeIds.size == storedDepths.size) {
            "nodeIds and depths must have the same size"
        }
        require(storedNodeIds.toSet().size == storedNodeIds.size) {
            "node IDs must be unique"
        }
        validateDepths(storedDepths)
    }

    override val size: Int
        get() = storedNodeIds.size

    override fun nodeIdAt(index: Int): Int = storedNodeIds[index]

    override fun depthAt(index: Int): Int = storedDepths[index]

    override fun filter(predicate: (Int) -> Boolean): Hierarchy {
        if (size == 0) return EMPTY

        var includedAtDepth = BooleanArray(1)
        val resultNodeIds = IntArray(size)
        val resultDepths = IntArray(size)
        var resultSize = 0

        for (index in storedNodeIds.indices) {
            val depth = storedDepths[index]
            if (depth >= includedAtDepth.size) {
                includedAtDepth = includedAtDepth.copyOf(
                    maxOf(depth + 1, includedAtDepth.size * 2),
                )
            }
            val parentIncluded = depth == 0 || includedAtDepth[depth - 1]
            val included = parentIncluded && predicate(storedNodeIds[index])
            includedAtDepth[depth] = included

            if (included) {
                resultNodeIds[resultSize] = storedNodeIds[index]
                resultDepths[resultSize] = depth
                resultSize += 1
            }
        }

        return ArrayBasedHierarchy(
            resultNodeIds.copyOf(resultSize),
            resultDepths.copyOf(resultSize),
        )
    }

    companion object {
        val EMPTY: Hierarchy = ArrayBasedHierarchy(IntArray(0), IntArray(0))

        private fun validateDepths(depths: IntArray) {
            if (depths.isEmpty()) return
            require(depths[0] == 0) { "the first node must be a root at depth 0" }

            for (index in depths.indices) {
                val depth = depths[index]
                require(depth >= 0) { "depth cannot be negative at index $index" }
                if (index > 0) {
                    require(depth <= depths[index - 1] + 1) {
                        "depth cannot skip a parent at index $index"
                    }
                }
            }
        }
    }
}
