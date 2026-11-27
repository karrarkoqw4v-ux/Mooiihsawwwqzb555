package com.rootmaster.engine

import kotlin.test.*

class EngineTest {
    private fun dev(
        manufacturer: String = "Google", abis: List<String> = listOf("arm64-v8a"), sdk: Int = 34,
        locked: Tri = Tri.YES, oem: Tri = Tri.YES, battery: Int? = 80, init: Tri = Tri.UNKNOWN, first: Int? = 31,
    ) = DeviceProfile(
        manufacturer, manufacturer, "X", "x", sdk, "14", "UQ1A", "fp", "release-keys", abis,
        locked, if (locked == Tri.YES) "green" else if (locked == Tri.NO) "orange" else null,
        oem, first, Tri.YES, init, battery,
    )

    @Test fun lockedPixelRequiresUnlock() {
        val r = CompatibilityEngine.evaluate(dev(), false)
        assertEquals(Verdict.REQUIRES_UNLOCK, r.verdict)
        assertTrue(Requirement.UNLOCK_BOOTLOADER in r.requirements)
        assertTrue(Risk.DATA_WIPE_ON_UNLOCK in r.risks)
    }

    @Test fun unlockedIsReady() {
        val r = CompatibilityEngine.evaluate(dev(locked = Tri.NO), false)
        assertEquals(Verdict.READY, r.verdict)
        assertFalse(Requirement.UNLOCK_BOOTLOADER in r.requirements)
    }

    @Test fun huaweiLockedBlocked() {
        val r = CompatibilityEngine.evaluate(dev(manufacturer = "HUAWEI"), false)
        assertEquals(Verdict.NOT_SUPPORTED, r.verdict)
        assertTrue(Blocker.VENDOR_NO_UNLOCK in r.blockers)
    }

    @Test fun noOemUnlockBlocked() {
        val r = CompatibilityEngine.evaluate(dev(oem = Tri.NO), false)
        assertEquals(Verdict.NOT_SUPPORTED, r.verdict)
        assertTrue(Blocker.OEM_UNLOCK_UNAVAILABLE in r.blockers)
    }

    @Test fun unsupportedAbiAndOldSdk() {
        assertEquals(Verdict.NOT_SUPPORTED, CompatibilityEngine.evaluate(dev(abis = listOf("mips")), false).verdict)
        assertEquals(Verdict.NOT_SUPPORTED, CompatibilityEngine.evaluate(dev(sdk = 22), false).verdict)
    }

    @Test fun unknownBootloaderIsUndetermined() {
        assertEquals(Verdict.UNDETERMINED, CompatibilityEngine.evaluate(dev(locked = Tri.UNKNOWN), false).verdict)
    }

    @Test fun rootedOverrides() {
        assertEquals(Verdict.ALREADY_ROOTED, CompatibilityEngine.evaluate(dev(), true).verdict)
    }

    @Test fun samsungAndXiaomiExtras() {
        val s = CompatibilityEngine.evaluate(dev(manufacturer = "samsung"), false)
        assertTrue(Risk.KNOX_TRIPPED in s.risks && Requirement.SAMSUNG_ODIN_FLOW in s.requirements)
        val x = CompatibilityEngine.evaluate(dev(manufacturer = "Xiaomi"), false)
        assertTrue(Requirement.XIAOMI_UNLOCK_ACCOUNT in x.requirements)
    }

    @Test fun bootTarget() {
        assertEquals(BootTarget.INIT_BOOT_IMAGE, CompatibilityEngine.evaluate(dev(init = Tri.YES), false).bootTarget)
        assertEquals(BootTarget.BOOT_IMAGE, CompatibilityEngine.evaluate(dev(init = Tri.NO, first = 34), false).bootTarget)
        assertEquals(BootTarget.UNDETERMINED, CompatibilityEngine.evaluate(dev(first = 30), false).bootTarget)
    }

    @Test fun lowBatteryRisk() {
        assertTrue(Risk.LOW_BATTERY in CompatibilityEngine.evaluate(dev(battery = 20), false).risks)
    }

    private fun probe(paths: List<String> = emptyList(), ran: Boolean = true, timeout: Boolean = false, code: Int? = 0, out: String = "", pk: List<String> = emptyList()) =
        RootProbe(paths, ran, timeout, code, out, pk)

    @Test fun classifier() {
        assertEquals(RootVerdict.ROOT_INSTALLED, RootClassifier.classify(probe(out = "uid=0(root) gid=0(root)"), true))
        assertEquals(RootVerdict.VERIFICATION_FAILED, RootClassifier.classify(probe(paths = listOf("/sbin/su"), code = 1), true))
        assertEquals(RootVerdict.VERIFICATION_FAILED, RootClassifier.classify(probe(code = null, pk = listOf("com.topjohnwu.magisk")), true))
        assertEquals(RootVerdict.ROOT_NOT_DETECTED, RootClassifier.classify(probe(code = null), true))
        assertEquals(RootVerdict.DEVICE_NOT_SUPPORTED, RootClassifier.classify(probe(code = null), false))
        // A shell that merely prints something uid-like but exited non-zero or timed out is not root.
        assertFalse(RootClassifier.isRootConfirmed(probe(out = "uid=0(root)", code = 1)))
        assertFalse(RootClassifier.isRootConfirmed(probe(out = "uid=0(root)", timeout = true)))
        assertFalse(RootClassifier.isRootConfirmed(probe(out = "uid=2000(shell)")))
    }

    @Test fun dbParsing() {
        val p = MagiskDb.parsePolicies("uid=10123|policy=2|until=0|logging=1|notification=1\nuid=10200|policy=1|until=0|logging=0|notification=1\n")
        assertEquals(2, p.size)
        assertEquals(PolicyAction.ALLOW, p[0].policy)
        assertFalse(p[1].logging)
        val l = MagiskDb.parseLogs("from_uid=10123|package_name=a.b|app_name=A|B app|command=/system/bin/sh|to_uid=0|action=2|time=1700000000\n")
        assertEquals("A|B app", l[0].appName)
        assertEquals(1700000000L, l[0].timeEpoch)
        assertTrue(MagiskDb.parsePolicies("").isEmpty())
    }

    @Test fun sqlOnlyIntegers() {
        assertEquals("DELETE FROM policies WHERE uid=10123", MagiskDb.revokeSql(10123))
        assertContains(MagiskDb.setPolicySql(10123, PolicyAction.ALLOW), "VALUES(10123,2,0,1,1)")
        assertFailsWith<IllegalArgumentException> { MagiskDb.revokeSql(-1) }
    }

    @Test fun digest() {
        val h = "a".repeat(64)
        assertTrue(Integrity.digestMatches("sha256:$h", h))
        assertFalse(Integrity.digestMatches(null, h))
        assertFalse(Integrity.digestMatches("sha256:" + "b".repeat(64), h))
        assertFalse(Integrity.digestMatches("sha256:abc", "abc"))
    }
}
