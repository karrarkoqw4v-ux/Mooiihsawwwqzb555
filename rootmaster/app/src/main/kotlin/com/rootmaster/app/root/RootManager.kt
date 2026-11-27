package com.rootmaster.app.root

import com.rootmaster.app.core.AppLog
import com.rootmaster.app.core.Shell
import com.rootmaster.engine.MagiskDb
import com.rootmaster.engine.PolicyAction
import com.rootmaster.engine.SuLogEntry
import com.rootmaster.engine.SuPolicy

data class EnvRow(val key: String, val value: String?)

/**
 * Root management through Magisk's own command-line interface (`magisk --sqlite`).
 * Only works when root was verified and the manager is Magisk. Every call goes through `su`,
 * so the root manager itself still decides whether this app may run it.
 */
object RootManager {
    private fun sqlite(sql: String) = Shell.su("magisk --sqlite " + shellQuote(sql))

    private fun shellQuote(s: String) = "'" + s.replace("'", "'\\''") + "'"

    fun verifyRoot(): Boolean {
        val r = Shell.su("id")
        val ok = r.ok && Regex("""uid=0\(root\)""").containsMatchIn(r.stdout)
        if (ok) AppLog.ok("Root verified: ${r.stdout}") else AppLog.error("Root verification failed: exit=${r.exitCode} timedOut=${r.timedOut}")
        return ok
    }

    fun policies(): Result<List<SuPolicy>> {
        val r = sqlite(MagiskDb.SELECT_POLICIES)
        return if (r.ok) Result.success(MagiskDb.parsePolicies(r.stdout)) else Result.failure(Exception(r.stderr.ifBlank { "exit ${r.exitCode}" }))
    }

    fun logs(): Result<List<SuLogEntry>> {
        val r = sqlite(MagiskDb.SELECT_LOGS)
        return if (r.ok) Result.success(MagiskDb.parseLogs(r.stdout)) else Result.failure(Exception(r.stderr.ifBlank { "no log table / exit ${r.exitCode}" }))
    }

    fun setPolicy(uid: Int, action: PolicyAction): Boolean {
        val r = sqlite(MagiskDb.setPolicySql(uid, action))
        AppLog.info("policy uid=$uid -> $action : exit=${r.exitCode}")
        return r.ok
    }

    fun revoke(uid: Int): Boolean {
        val r = sqlite(MagiskDb.revokeSql(uid))
        AppLog.info("revoke uid=$uid : exit=${r.exitCode}")
        return r.ok
    }

    fun environment(): List<EnvRow> = listOf(
        EnvRow("Magisk version", Shell.su("magisk -v").takeIf { it.ok }?.stdout),
        EnvRow("Magisk version code", Shell.su("magisk -V").takeIf { it.ok }?.stdout),
        EnvRow("Identity", Shell.su("id").takeIf { it.ok }?.stdout),
        EnvRow("SELinux context", Shell.su("id -Z").takeIf { it.ok }?.stdout),
        EnvRow("Magisk path", Shell.su("magisk --path").takeIf { it.ok }?.stdout),
        EnvRow("Modules", Shell.su("ls /data/adb/modules").takeIf { it.ok }?.stdout?.ifBlank { "none" }),
        EnvRow("Kernel", Shell.su("uname -a").takeIf { it.ok }?.stdout),
    )

    /** Checks that the files a working Magisk install needs are actually present. */
    fun integrity(): List<EnvRow> = listOf(
        "magisk binary" to "command -v magisk",
        "Magisk data dir" to "test -d /data/adb/magisk && echo present",
        "Magisk database" to "test -f /data/adb/magisk.db && echo present",
        "Modules dir" to "test -d /data/adb/modules && echo present",
    ).map { (label, cmd) -> EnvRow(label, Shell.su(cmd).takeIf { it.ok && it.stdout.isNotBlank() }?.stdout) }

    fun systemStatus(): List<EnvRow> = listOf(
        EnvRow("Uptime", Shell.su("uptime").takeIf { it.ok }?.stdout),
        EnvRow("SELinux mode", Shell.su("getenforce").takeIf { it.ok }?.stdout),
        EnvRow("Memory", Shell.su("grep -E 'MemTotal|MemAvailable' /proc/meminfo").takeIf { it.ok }?.stdout?.replace("\n", "; ")),
    )

    /** Reboot is only possible with verified root and only after explicit user confirmation in the UI. */
    fun reboot(): Boolean = Shell.su("svc power reboot || reboot", timeoutMs = 5_000).let { it.ok || it.timedOut }
}
