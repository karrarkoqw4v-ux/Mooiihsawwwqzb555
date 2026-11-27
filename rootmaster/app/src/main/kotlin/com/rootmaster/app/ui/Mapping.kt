package com.rootmaster.app.ui

import com.rootmaster.app.R
import com.rootmaster.engine.*

fun Verdict.res() = when (this) {
    Verdict.ALREADY_ROOTED -> R.string.verdict_rooted
    Verdict.READY -> R.string.verdict_ready
    Verdict.REQUIRES_UNLOCK -> R.string.verdict_unlock
    Verdict.NOT_SUPPORTED -> R.string.verdict_unsupported
    Verdict.UNDETERMINED -> R.string.verdict_undetermined
}

fun RootVerdict.res() = when (this) {
    RootVerdict.ROOT_INSTALLED -> R.string.rv_installed
    RootVerdict.ROOT_NOT_DETECTED -> R.string.rv_not_detected
    RootVerdict.VERIFICATION_FAILED -> R.string.rv_failed
    RootVerdict.DEVICE_NOT_SUPPORTED -> R.string.rv_unsupported
}

fun CheckId.res() = when (this) {
    CheckId.ABI -> R.string.chk_abi
    CheckId.ANDROID_VERSION -> R.string.chk_android
    CheckId.BOOTLOADER -> R.string.chk_bootloader
    CheckId.VERIFIED_BOOT -> R.string.chk_vb
    CheckId.OEM_UNLOCK -> R.string.chk_oem
    CheckId.OEM_POLICY -> R.string.chk_policy
    CheckId.BOOT_TARGET -> R.string.chk_target
    CheckId.BUILD_TYPE -> R.string.chk_build
    CheckId.BATTERY -> R.string.chk_battery
}

fun Blocker.res() = when (this) {
    Blocker.ABI_UNSUPPORTED -> R.string.blk_abi
    Blocker.ANDROID_TOO_OLD -> R.string.blk_android
    Blocker.OEM_UNLOCK_UNAVAILABLE -> R.string.blk_oem
    Blocker.VENDOR_NO_UNLOCK -> R.string.blk_vendor
}

fun Requirement.res() = when (this) {
    Requirement.PC_WITH_FASTBOOT -> R.string.req_pc
    Requirement.USB_CABLE -> R.string.req_usb
    Requirement.MATCHING_STOCK_BOOT_IMAGE -> R.string.req_image
    Requirement.BACKUP_DATA -> R.string.req_backup
    Requirement.BATTERY_50 -> R.string.req_battery
    Requirement.UNLOCK_BOOTLOADER -> R.string.req_unlock
    Requirement.ENABLE_OEM_UNLOCK_TOGGLE -> R.string.req_toggle
    Requirement.XIAOMI_UNLOCK_ACCOUNT -> R.string.req_xiaomi
    Requirement.SAMSUNG_ODIN_FLOW -> R.string.req_samsung
    Requirement.OFFICIAL_MAGISK_APP -> R.string.req_magisk
}

fun Risk.res() = when (this) {
    Risk.DATA_WIPE_ON_UNLOCK -> R.string.risk_wipe
    Risk.BOOTLOOP_WRONG_IMAGE -> R.string.risk_bootloop
    Risk.WARRANTY_VOID -> R.string.risk_warranty
    Risk.KNOX_TRIPPED -> R.string.risk_knox
    Risk.INTEGRITY_APPS_FAIL -> R.string.risk_integrity
    Risk.OTA_REMOVES_ROOT -> R.string.risk_ota
    Risk.BOOT_WARNING_SCREEN -> R.string.risk_warning_screen
    Risk.LOW_BATTERY -> R.string.risk_battery
}

fun BootTarget.res() = when (this) {
    BootTarget.BOOT_IMAGE -> R.string.target_boot
    BootTarget.INIT_BOOT_IMAGE -> R.string.target_init
    BootTarget.UNDETERMINED -> R.string.target_unknown
}
