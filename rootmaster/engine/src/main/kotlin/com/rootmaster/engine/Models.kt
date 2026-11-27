package com.rootmaster.engine

/** Three-valued answer: the app must never turn "unknown" into a fact. */
enum class Tri { YES, NO, UNKNOWN }

/** Plain description of the device, filled in by the Android layer. */
data class DeviceProfile(
    val manufacturer: String,
    val brand: String,
    val model: String,
    val device: String,
    val sdkInt: Int,
    val release: String,
    val buildId: String,
    val fingerprint: String,
    val buildTags: String,
    val supportedAbis: List<String>,
    val bootloaderLocked: Tri,
    val verifiedBootState: String?,
    val oemUnlockSupported: Tri,
    val firstApiLevel: Int?,
    val abDevice: Tri,
    val initBootPartition: Tri,
    val batteryPercent: Int?,
)

enum class RootVerdict { ROOT_INSTALLED, ROOT_NOT_DETECTED, VERIFICATION_FAILED, DEVICE_NOT_SUPPORTED }

/** Raw observations made by the Android layer while probing for root. */
data class RootProbe(
    val suBinaryPaths: List<String>,
    val suProbeRan: Boolean,
    val suTimedOut: Boolean,
    val suExitCode: Int?,
    val suOutput: String,
    val managerPackages: List<String>,
)
