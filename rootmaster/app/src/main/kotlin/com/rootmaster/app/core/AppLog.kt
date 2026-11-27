package com.rootmaster.app.core

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.atomic.AtomicLong

enum class Level { INFO, OK, WARN, ERROR, SECTION }

data class LogEntry(val id: Long, val time: Long, val level: Level, val message: String)

/** Single event log used by every module and rendered by the terminal screen. */
object AppLog {
    private const val MAX = 800
    private val counter = AtomicLong(0)
    private val _entries = MutableStateFlow<List<LogEntry>>(emptyList())
    val entries: StateFlow<List<LogEntry>> = _entries
    private var file: File? = null

    fun init(context: Context) {
        file = File(context.filesDir, "rootmaster.log")
    }

    @Synchronized
    fun add(level: Level, message: String) {
        val e = LogEntry(counter.incrementAndGet(), System.currentTimeMillis(), level, message)
        _entries.value = (_entries.value + e).takeLast(MAX)
        runCatching {
            val f = file ?: return@runCatching
            if (f.length() > 512_000) f.writeText("")
            f.appendText("${SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date(e.time))} [$level] $message\n")
        }
    }

    fun section(title: String) = add(Level.SECTION, title)
    fun info(m: String) = add(Level.INFO, m)
    fun ok(m: String) = add(Level.OK, m)
    fun warn(m: String) = add(Level.WARN, m)
    fun error(m: String) = add(Level.ERROR, m)

    fun clear() { _entries.value = emptyList() }
}
