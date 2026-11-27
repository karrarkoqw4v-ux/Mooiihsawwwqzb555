package com.rootmaster.app.core

import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

data class ShellResult(val exitCode: Int?, val stdout: String, val stderr: String, val timedOut: Boolean) {
    val ok: Boolean get() = !timedOut && exitCode == 0
}

object Shell {
    fun run(vararg cmd: String, timeoutMs: Long = 5_000): ShellResult {
        val proc = try {
            ProcessBuilder(*cmd).redirectErrorStream(false).start()
        } catch (e: Exception) {
            return ShellResult(null, "", e.message ?: e.javaClass.simpleName, false)
        }
        val out = StringBuilder()
        val err = StringBuilder()
        val t1 = thread(isDaemon = true) { runCatching { out.append(proc.inputStream.bufferedReader().readText()) } }
        val t2 = thread(isDaemon = true) { runCatching { err.append(proc.errorStream.bufferedReader().readText()) } }
        runCatching { proc.outputStream.close() }
        val finished = try { proc.waitFor(timeoutMs, TimeUnit.MILLISECONDS) } catch (_: InterruptedException) { false }
        if (!finished) proc.destroyForcibly()
        runCatching { t1.join(500); t2.join(500) }
        return ShellResult(if (finished) proc.exitValue() else null, out.toString().trim(), err.toString().trim(), !finished)
    }

    /** Runs a command through `su`. Triggers the root manager's consent prompt on the device. */
    fun su(command: String, timeoutMs: Long = 20_000): ShellResult = run("su", "-c", command, timeoutMs = timeoutMs)

    fun getprop(key: String): String? =
        run("getprop", key).takeIf { it.ok }?.stdout?.trim()?.takeIf { it.isNotEmpty() }
}
