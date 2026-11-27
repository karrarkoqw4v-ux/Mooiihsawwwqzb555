package com.rootmaster.app.root

import android.content.Context
import android.content.pm.PackageManager
import com.rootmaster.app.core.AppLog
import com.rootmaster.app.core.Shell
import com.rootmaster.engine.RootProbe
import java.io.File

object RootDetector {
    private val SU_PATHS = listOf(
        "/system/bin/su", "/system/xbin/su", "/sbin/su", "/system/sbin/su", "/vendor/bin/su",
        "/su/bin/su", "/system_ext/bin/su", "/product/bin/su", "/debug_ramdisk/su", "/data/local/bin/su",
    )

    val MANAGERS = mapOf(
        "com.topjohnwu.magisk" to "Magisk",
        "me.weishu.kernelsu" to "KernelSU",
        "me.bmax.apatch" to "APatch",
        "eu.chainfire.supersu" to "SuperSU",
    )

    fun installedManagers(ctx: Context): List<String> = MANAGERS.keys.filter { pkg ->
        try { ctx.packageManager.getPackageInfo(pkg, 0); true } catch (_: PackageManager.NameNotFoundException) { false }
    }

    fun managerVersion(ctx: Context, pkg: String): String? = try {
        ctx.packageManager.getPackageInfo(pkg, 0).versionName
    } catch (_: PackageManager.NameNotFoundException) { null }

    /** Runs the real probe. `su -c id` may show the root manager's consent prompt on the device. */
    fun probe(ctx: Context): RootProbe {
        val paths = SU_PATHS.filter { runCatching { File(it).exists() }.getOrDefault(false) }
        val managers = installedManagers(ctx)
        AppLog.info("su binaries visible to this app: ${paths.ifEmpty { listOf("none") }.joinToString()}")
        AppLog.info("Root manager apps installed: ${managers.map { MANAGERS[it] }.ifEmpty { listOf("none") }.joinToString()}")
        val r = Shell.su("id", timeoutMs = 20_000)
        AppLog.info("`su -c id` -> exit=${r.exitCode} timedOut=${r.timedOut} out='${r.stdout.take(80)}' err='${r.stderr.take(80)}'")
        return RootProbe(paths, suProbeRan = r.exitCode != null || r.timedOut, suTimedOut = r.timedOut,
            suExitCode = r.exitCode, suOutput = r.stdout, managerPackages = managers)
    }
}
