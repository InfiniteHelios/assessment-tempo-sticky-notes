package com.tempo.hierarchy

interface Hierarchy {
    val size: Int

    fun nodeIdAt(index: Int): Int

    fun depthAt(index: Int): Int

    fun filter(predicate: (Int) -> Boolean): Hierarchy

    fun nodeIds(): IntArray = IntArray(size, ::nodeIdAt)

    fun depths(): IntArray = IntArray(size, ::depthAt)
}
