package com.rootmaster.engine

object Integrity {
    /** Constant-format comparison of a published SHA-256 digest ("sha256:<hex>" or bare hex) with a computed one. */
    fun digestMatches(published: String?, computedHex: String): Boolean {
        if (published.isNullOrBlank()) return false
        val exp = published.trim().lowercase().removePrefix("sha256:")
        return exp.length == 64 && exp.all { it in '0'..'9' || it in 'a'..'f' } && exp == computedHex.lowercase()
    }
}
