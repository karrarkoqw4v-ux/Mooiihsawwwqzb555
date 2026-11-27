package com.rootmaster.engine

enum class Verdict { ALREADY_ROOTED, READY, REQUIRES_UNLOCK, NOT_SUPPORTED, UNDETERMINED }

enum class CheckId { ABI, ANDROID_VERSION, BOOTLOADER, VERIFIED_BOOT, OEM_UNLOCK, OEM_POLICY, BOOT_TARGET, BUILD_TYPE, BATTERY }
enum class CheckResult { PASS, FAIL, UNKNOWN }
data class Check(val id: CheckId, val result: CheckResult, val detail: String = "")

enum class Blocker { ABI_UNSUPPORTED, ANDROID_TOO_OLD, OEM_UNLOCK_UNAVAILABLE, VENDOR_NO_UNLOCK }

enum class Requirement {
    PC_WITH_FASTBOOT, USB_CABLE, MATCHING_STOCK_BOOT_IMAGE, BACKUP_DATA, BATTERY_50,
    UNLOCK_BOOTLOADER, ENABLE_OEM_UNLOCK_TOGGLE, XIAOMI_UNLOCK_ACCOUNT, SAMSUNG_ODIN_FLOW, OFFICIAL_MAGISK_APP,
}

enum class Risk {
    DATA_WIPE_ON_UNLOCK, BOOTLOOP_WRONG_IMAGE, WARRANTY_VOID, KNOX_TRIPPED,
    INTEGRITY_APPS_FAIL, OTA_REMOVES_ROOT, BOOT_WARNING_SCREEN, LOW_BATTERY,
}

enum class BootTarget { BOOT_IMAGE, INIT_BOOT_IMAGE, UNDETERMINED }

data class CompatibilityReport(
    val verdict: Verdict,
    val checks: List<Check>,
    val blockers: List<Blocker>,
    val requirements: List<Requirement>,
    val risks: List<Risk>,
    val bootTarget: BootTarget,
    /** Rooting method this report refers to. Only the official Magisk boot-image patch is evaluated. */
    val method: String = "Magisk (official boot-image patch)",
)

object CompatibilityEngine {
    const val MIN_SDK_FOR_MAGISK = 23
    private val SUPPORTED_ABIS = setOf("arm64-v8a", "armeabi-v7a", "x86", "x86_64")

    private fun vendor(p: DeviceProfile): String {
        val s = (p.manufacturer + " " + p.brand).lowercase()
        return when {
            "huawei" in s || "honor" in s -> "huawei"
            "samsung" in s -> "samsung"
            "xiaomi" in s || "redmi" in s || "poco" in s -> "xiaomi"
            "google" in s -> "google"
            else -> "generic"
        }
    }

    fun evaluate(p: DeviceProfile, rootConfirmed: Boolean): CompatibilityReport {
        val v = vendor(p)
        val checks = mutableListOf<Check>()
        val blockers = mutableListOf<Blocker>()

        val abiOk = p.supportedAbis.any { it in SUPPORTED_ABIS }
        checks += Check(CheckId.ABI, if (abiOk) CheckResult.PASS else CheckResult.FAIL, p.supportedAbis.joinToString())
        if (!abiOk) blockers += Blocker.ABI_UNSUPPORTED

        val sdkOk = p.sdkInt >= MIN_SDK_FOR_MAGISK
        checks += Check(CheckId.ANDROID_VERSION, if (sdkOk) CheckResult.PASS else CheckResult.FAIL, "API ${p.sdkInt}")
        if (!sdkOk) blockers += Blocker.ANDROID_TOO_OLD

        checks += Check(
            CheckId.BOOTLOADER,
            when (p.bootloaderLocked) { Tri.NO -> CheckResult.PASS; Tri.YES -> CheckResult.FAIL; Tri.UNKNOWN -> CheckResult.UNKNOWN },
            when (p.bootloaderLocked) { Tri.NO -> "unlocked"; Tri.YES -> "locked"; Tri.UNKNOWN -> "unknown" },
        )
        val vb = p.verifiedBootState
        checks += Check(
            CheckId.VERIFIED_BOOT,
            if (vb == null) CheckResult.UNKNOWN else if (vb == "green") CheckResult.FAIL else CheckResult.PASS,
            vb ?: "unknown",
        )

        val locked = p.bootloaderLocked == Tri.YES
        val oemUnlockMissing = locked && p.oemUnlockSupported == Tri.NO
        checks += Check(
            CheckId.OEM_UNLOCK,
            when (p.oemUnlockSupported) { Tri.YES -> CheckResult.PASS; Tri.NO -> CheckResult.FAIL; Tri.UNKNOWN -> CheckResult.UNKNOWN },
        )
        if (oemUnlockMissing) blockers += Blocker.OEM_UNLOCK_UNAVAILABLE

        val vendorBlocked = v == "huawei" && locked
        checks += Check(CheckId.OEM_POLICY, if (vendorBlocked) CheckResult.FAIL else CheckResult.PASS, v)
        if (vendorBlocked) blockers += Blocker.VENDOR_NO_UNLOCK

        val bootTarget = when {
            p.initBootPartition == Tri.YES -> BootTarget.INIT_BOOT_IMAGE
            p.initBootPartition == Tri.NO -> BootTarget.BOOT_IMAGE
            p.firstApiLevel != null && p.firstApiLevel >= 33 -> BootTarget.INIT_BOOT_IMAGE
            else -> BootTarget.UNDETERMINED
        }
        checks += Check(CheckId.BOOT_TARGET, if (bootTarget == BootTarget.UNDETERMINED) CheckResult.UNKNOWN else CheckResult.PASS, bootTarget.name)

        val testKeys = "test-keys" in p.buildTags
        checks += Check(CheckId.BUILD_TYPE, CheckResult.PASS, p.buildTags.ifBlank { "unknown" })

        val lowBattery = p.batteryPercent != null && p.batteryPercent < 50
        checks += Check(
            CheckId.BATTERY,
            when { p.batteryPercent == null -> CheckResult.UNKNOWN; lowBattery -> CheckResult.FAIL; else -> CheckResult.PASS },
            p.batteryPercent?.toString() ?: "unknown",
        )

        val verdict = when {
            rootConfirmed -> Verdict.ALREADY_ROOTED
            blockers.isNotEmpty() -> Verdict.NOT_SUPPORTED
            p.bootloaderLocked == Tri.NO -> Verdict.READY
            p.bootloaderLocked == Tri.YES -> Verdict.REQUIRES_UNLOCK
            else -> Verdict.UNDETERMINED
        }

        val req = linkedSetOf(
            Requirement.PC_WITH_FASTBOOT, Requirement.USB_CABLE, Requirement.MATCHING_STOCK_BOOT_IMAGE,
            Requirement.BACKUP_DATA, Requirement.BATTERY_50, Requirement.OFFICIAL_MAGISK_APP,
        )
        val needsUnlock = verdict == Verdict.REQUIRES_UNLOCK || verdict == Verdict.UNDETERMINED
        if (needsUnlock) {
            req += Requirement.UNLOCK_BOOTLOADER
            req += Requirement.ENABLE_OEM_UNLOCK_TOGGLE
            if (v == "xiaomi") req += Requirement.XIAOMI_UNLOCK_ACCOUNT
        }
        if (v == "samsung") req += Requirement.SAMSUNG_ODIN_FLOW

        val risks = linkedSetOf(Risk.BOOTLOOP_WRONG_IMAGE, Risk.WARRANTY_VOID, Risk.INTEGRITY_APPS_FAIL, Risk.OTA_REMOVES_ROOT)
        if (needsUnlock) { risks += Risk.DATA_WIPE_ON_UNLOCK; risks += Risk.BOOT_WARNING_SCREEN }
        if (v == "samsung") risks += Risk.KNOX_TRIPPED
        if (lowBattery) risks += Risk.LOW_BATTERY
        if (testKeys) risks += Risk.BOOT_WARNING_SCREEN

        return CompatibilityReport(
            verdict = verdict,
            checks = checks,
            blockers = blockers,
            requirements = if (verdict == Verdict.NOT_SUPPORTED || verdict == Verdict.ALREADY_ROOTED) emptyList() else req.toList(),
            risks = if (verdict == Verdict.NOT_SUPPORTED || verdict == Verdict.ALREADY_ROOTED) emptyList() else risks.toList(),
            bootTarget = bootTarget,
        )
    }
}
