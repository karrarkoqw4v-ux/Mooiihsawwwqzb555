package com.rootmaster.app.device

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.provider.Settings
import com.rootmaster.app.core.Shell
import com.rootmaster.engine.DeviceProfile
import com.rootmaster.engine.Tri
import java.io.File

/** One display row. `value == null` means the value could not be obtained and is shown as "Unavailable". */
data class InfoRow(val key: String, val value: String?)

data class DeviceSnapshot(val profile: DeviceProfile, val rows: List<InfoRow>, val partitions: List<String>?)

object DeviceInfo {
    private fun gb(bytes: Long) = "%.1f GB".format(bytes / 1024.0 / 1024.0 / 1024.0)

    fun collect(ctx: Context): DeviceSnapshot {
        val am = ctx.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val mi = ActivityManager.MemoryInfo().also { am.getMemoryInfo(it) }
        val stat = StatFs(Environment.getDataDirectory().path)
        val batt = ctx.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = batt?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = batt?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        val pct = if (level >= 0 && scale > 0) level * 100 / scale else null
        val status = batt?.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
        val charging = when (status) {
            BatteryManager.BATTERY_STATUS_CHARGING -> "Charging"
            BatteryManager.BATTERY_STATUS_FULL -> "Full"
            BatteryManager.BATTERY_STATUS_DISCHARGING, BatteryManager.BATTERY_STATUS_NOT_CHARGING -> "Not charging"
            else -> null
        }

        val flashLocked = Shell.getprop("ro.boot.flash.locked")
        val vbState = Shell.getprop("ro.boot.verifiedbootstate")
        val vbmetaState = Shell.getprop("ro.boot.vbmeta.device_state")
        val locked = when {
            vbmetaState == "locked" || flashLocked == "1" || vbState == "green" -> Tri.YES
            vbmetaState == "unlocked" || flashLocked == "0" || vbState == "orange" -> Tri.NO
            else -> Tri.UNKNOWN
        }
        val oemSupported = Shell.getprop("ro.oem_unlock_supported").let {
            when (it) { "1" -> Tri.YES; "0" -> Tri.NO; else -> Tri.UNKNOWN }
        }
        val slot = Shell.getprop("ro.boot.slot_suffix")
        val ab = if (slot != null) Tri.YES else if (Shell.getprop("ro.build.ab_update") == "true") Tri.YES else Tri.UNKNOWN
        val partitions = listPartitions()
        val initBoot = when {
            partitions == null -> Tri.UNKNOWN
            partitions.any { it.startsWith("init_boot") } -> Tri.YES
            else -> Tri.NO
        }
        val firstApi = Shell.getprop("ro.product.first_api_level")?.toIntOrNull()
        val selinux = selinuxMode()
        val cpu = cpuModel()
        val kernel = System.getProperty("os.version")
        // Settings.Global.ADB_ENABLED is a public, unprotected key: any app may read it.
        val usbDebugging = runCatching { Settings.Global.getInt(ctx.contentResolver, Settings.Global.ADB_ENABLED) }
            .getOrNull()?.let { it == 1 }
        // There is no public Android API letting a normal app read the live on/off state of the
        // "OEM unlocking" developer-options toggle (OemLockManager.isOemUnlockAllowed() needs a
        // signature/privileged permission). ro.oem_unlock_supported above only says whether the
        // hardware offers that toggle at all, not whether the user has switched it on.

        val profile = DeviceProfile(
            manufacturer = Build.MANUFACTURER, brand = Build.BRAND, model = Build.MODEL, device = Build.DEVICE,
            sdkInt = Build.VERSION.SDK_INT, release = Build.VERSION.RELEASE, buildId = Build.ID,
            fingerprint = Build.FINGERPRINT, buildTags = Build.TAGS ?: "",
            supportedAbis = Build.SUPPORTED_ABIS.toList(),
            bootloaderLocked = locked, verifiedBootState = vbState, oemUnlockSupported = oemSupported,
            firstApiLevel = firstApi, abDevice = ab, initBootPartition = initBoot, batteryPercent = pct,
        )

        val rows = listOf(
            InfoRow("Device name", Settings.Global.getString(ctx.contentResolver, "device_name") ?: Build.DEVICE),
            InfoRow("Manufacturer", Build.MANUFACTURER),
            InfoRow("Model", Build.MODEL),
            InfoRow("Android version", "${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})"),
            InfoRow("Security patch", Build.VERSION.SECURITY_PATCH),
            InfoRow("Vendor UI version", vendorUi()),
            InfoRow("Build", "${Build.ID} / ${Build.TYPE} / ${Build.TAGS}"),
            InfoRow("Fingerprint", Build.FINGERPRINT),
            InfoRow("Kernel", kernel),
            InfoRow("CPU architecture", Build.SUPPORTED_ABIS.joinToString()),
            InfoRow("CPU", cpu ?: Build.HARDWARE),
            InfoRow("RAM", "${gb(mi.totalMem)} total, ${gb(mi.availMem)} free"),
            InfoRow("Storage (data)", "${gb(stat.totalBytes)} total, ${gb(stat.availableBytes)} free"),
            InfoRow("Battery", pct?.let { "$it%" }),
            InfoRow("Charging state", charging),
            InfoRow("Bootloader", when (locked) { Tri.YES -> "Locked"; Tri.NO -> "Unlocked"; Tri.UNKNOWN -> null }),
            InfoRow("Verified Boot", vbState),
            InfoRow("OEM unlock supported by hardware", when (oemSupported) { Tri.YES -> "Yes"; Tri.NO -> "No"; Tri.UNKNOWN -> null }),
            // Deliberately null: no normal app can read this toggle's live state (see note above).
            InfoRow("OEM unlocking toggle (Developer options)", null),
            InfoRow("USB debugging", usbDebugging?.let { if (it) "Enabled" else "Disabled" }),
            InfoRow("SELinux", selinux),
            InfoRow("A/B slots", when (ab) { Tri.YES -> "Yes ($slot)"; else -> null }),
            InfoRow("First API level", firstApi?.toString()),
            InfoRow("Partitions", partitions?.joinToString(", ")),
        )
        return DeviceSnapshot(profile, rows, partitions)
    }

    private fun vendorUi(): String? = listOf(
        "ro.build.version.oneui", "ro.miui.ui.version.name", "ro.build.version.opporom",
        "ro.build.version.emui", "ro.vivo.os.version", "ro.build.display.id",
    ).firstNotNullOfOrNull { Shell.getprop(it) }

    private fun selinuxMode(): String? {
        runCatching {
            val f = File("/sys/fs/selinux/enforce")
            if (f.canRead()) return if (f.readText().trim() == "1") "Enforcing" else "Permissive"
        }
        val r = Shell.run("getenforce")
        return if (r.ok && r.stdout.isNotBlank()) r.stdout else null
    }

    private fun cpuModel(): String? = runCatching {
        File("/proc/cpuinfo").readLines().firstOrNull { it.startsWith("Hardware") || it.startsWith("model name") }
            ?.substringAfter(":")?.trim()
    }.getOrNull()

    /** Named block devices if the system lets an app list them; null when access is denied (common). */
    private fun listPartitions(): List<String>? {
        val names = runCatching { File("/dev/block/by-name").list()?.sorted() }.getOrNull()
        if (!names.isNullOrEmpty()) return names.filter { n ->
            n.removeSuffix("_a").removeSuffix("_b") in setOf("boot", "init_boot", "vendor_boot", "vbmeta", "recovery", "system", "vendor", "dtbo", "super")
        }
        return null
    }
}
