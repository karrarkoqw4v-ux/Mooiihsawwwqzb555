package com.rootmaster.engine

object RootClassifier {
    private val uidZero = Regex("""uid=0\(root\)""")

    /** Root is only reported when `su -c id` really returned uid 0. */
    fun isRootConfirmed(p: RootProbe): Boolean =
        p.suProbeRan && !p.suTimedOut && p.suExitCode == 0 && uidZero.containsMatchIn(p.suOutput)

    fun classify(p: RootProbe, deviceSupported: Boolean): RootVerdict = when {
        isRootConfirmed(p) -> RootVerdict.ROOT_INSTALLED
        p.suBinaryPaths.isNotEmpty() || p.managerPackages.isNotEmpty() -> RootVerdict.VERIFICATION_FAILED
        !deviceSupported -> RootVerdict.DEVICE_NOT_SUPPORTED
        else -> RootVerdict.ROOT_NOT_DETECTED
    }
}
