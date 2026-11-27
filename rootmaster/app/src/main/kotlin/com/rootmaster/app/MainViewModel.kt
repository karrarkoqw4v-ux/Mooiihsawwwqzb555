package com.rootmaster.app

import android.app.Application
import android.content.Intent
import android.provider.Settings
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.rootmaster.app.core.AppLog
import com.rootmaster.app.core.Prefs
import com.rootmaster.app.device.DeviceInfo
import com.rootmaster.app.device.DeviceSnapshot
import com.rootmaster.app.permissions.PermItem
import com.rootmaster.app.permissions.PermissionManager
import com.rootmaster.app.root.*
import com.rootmaster.engine.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

enum class FileStatus { NONE, DOWNLOADING, VERIFIED, FAILED }

data class ScanState(val running: Boolean = false, val step: Int = 0, val total: Int = 7, val finished: Boolean = false) {
    val progress: Float get() = if (total == 0) 0f else step.toFloat() / total
}

data class InstallState(
    val release: MagiskRelease? = null,
    val lookingUp: Boolean = false,
    val lookupFailed: Boolean = false,
    val file: FileStatus = FileStatus.NONE,
    val progress: Float = 0f,
    val verifiedFile: File? = null,
    val error: String? = null,
)

data class PolicyRow(val uid: Int, val apps: List<String>, val policy: PolicyAction?)
data class LogRow(val entry: SuLogEntry, val label: String)

data class MgmtState(
    val loading: Boolean = false,
    val rootVerified: Boolean? = null,
    val policies: List<PolicyRow> = emptyList(),
    val policiesError: String? = null,
    val logs: List<LogRow> = emptyList(),
    val logsError: String? = null,
    val env: List<EnvRow> = emptyList(),
    val integrity: List<EnvRow> = emptyList(),
    val system: List<EnvRow> = emptyList(),
)

class MainViewModel(app: Application) : AndroidViewModel(app) {
    private val ctx get() = getApplication<Application>()
    val prefs = Prefs(app)
    private val permMgr = PermissionManager(app, prefs)

    val onboardingDone = MutableStateFlow(prefs.onboardingDone)
    val perms = MutableStateFlow<List<PermItem>>(emptyList())
    val device = MutableStateFlow<DeviceSnapshot?>(null)
    val probe = MutableStateFlow<RootProbe?>(null)
    val rootVerdict = MutableStateFlow<RootVerdict?>(null)
    val report = MutableStateFlow<CompatibilityReport?>(null)
    val scan = MutableStateFlow(ScanState())
    val install = MutableStateFlow(InstallState())
    val mgmt = MutableStateFlow(MgmtState())
    /** Set when the app is reopened after the user announced a flash/reboot. */
    val postRebootVerdict = MutableStateFlow<RootVerdict?>(null)
    val pendingVerification = MutableStateFlow(prefs.pendingBootCount != -1)

    val rootConfirmed: Boolean get() = rootVerdict.value == RootVerdict.ROOT_INSTALLED
    val isMagisk: Boolean get() = probe.value?.managerPackages?.contains("com.topjohnwu.magisk") == true

    init {
        refreshPerms()
        viewModelScope.launch(Dispatchers.IO) {
            scanNow()
            val pending = prefs.pendingBootCount
            if (pending != -1 && bootCount() != pending) {
                AppLog.section("POST-REBOOT VERIFICATION")
                AppLog.info("Boot counter changed ($pending -> ${bootCount()}): device was restarted")
                postRebootVerdict.value = rootVerdict.value
                prefs.pendingBootCount = -1
                pendingVerification.value = false
            }
        }
    }

    private fun bootCount(): Int = Settings.Global.getInt(ctx.contentResolver, "boot_count", -1)

    // ---------- permissions ----------
    fun refreshPerms() { perms.value = permMgr.snapshot() }
    fun setConsent(id: String, allowed: Boolean) { permMgr.setConsent(id, allowed); refreshPerms() }
    fun settingsIntent(id: String): Intent? = permMgr.settingsIntentFor(id)
    fun allDecided() = permMgr.allDecided(perms.value)
    fun confirmPermissions() { prefs.onboardingDone = true; onboardingDone.value = true }
    private fun consented(id: String) = perms.value.firstOrNull { it.id == id }?.consent == true

    // ---------- diagnostic scan (drives the terminal screen; progress = steps really completed) ----------
    fun runScan() { viewModelScope.launch(Dispatchers.IO) { scanNow() } }

    private suspend fun scanNow() {
        if (scan.value.running) return
        run {
            AppLog.clear()
            scan.value = ScanState(running = true, step = 0)
            fun done(n: Int) = scan.update { it.copy(step = n) }

            AppLog.section("DEVICE DETECTED")
            val snap = DeviceInfo.collect(ctx)
            device.value = snap
            val p = snap.profile
            AppLog.info("${p.manufacturer} ${p.model} (${p.device}), Android ${p.release}, build ${p.buildId}")
            done(1)

            AppLog.section("DEVICE INFORMATION")
            snap.rows.forEach { AppLog.info("${it.key}: ${it.value ?: "Unavailable"}") }
            done(2)

            AppLog.section("COMPATIBILITY CHECK")
            var rep = CompatibilityEngine.evaluate(p, false)
            report.value = rep
            rep.checks.forEach { c ->
                val lvl = when (c.result) { CheckResult.PASS -> "PASS"; CheckResult.FAIL -> "FAIL"; CheckResult.UNKNOWN -> "UNKNOWN" }
                AppLog.add(if (c.result == CheckResult.FAIL) com.rootmaster.app.core.Level.WARN else com.rootmaster.app.core.Level.INFO, "${c.id.name}: $lvl ${c.detail}")
            }
            rep.blockers.forEach { AppLog.error("BLOCKER: ${it.name}") }
            done(3)

            AppLog.section("ROOT ENVIRONMENT CHECK")
            val pr = RootDetector.probe(ctx)
            probe.value = pr
            done(4)

            AppLog.section("COMPONENT VERIFICATION")
            RootDetector.installedManagers(ctx).forEach {
                AppLog.info("${RootDetector.MANAGERS[it]} app version: ${RootDetector.managerVersion(ctx, it) ?: "?"}")
            }
            if (RootClassifier.isRootConfirmed(pr) && pr.managerPackages.contains("com.topjohnwu.magisk")) {
                RootManager.integrity().forEach { AppLog.info("${it.key}: ${it.value ?: "NOT FOUND"}") }
            } else {
                AppLog.info("Component file checks need verified root; skipped")
            }
            done(5)

            AppLog.section("INSTALLATION STATUS")
            val verdict = RootClassifier.classify(pr, rep.verdict != Verdict.NOT_SUPPORTED)
            rootVerdict.value = verdict
            rep = CompatibilityEngine.evaluate(p, verdict == RootVerdict.ROOT_INSTALLED)
            report.value = rep
            AppLog.info("Magisk app installed: ${pr.managerPackages.contains("com.topjohnwu.magisk")}")
            AppLog.info("Compatibility verdict: ${rep.verdict}")
            done(6)

            AppLog.section("FINAL VERIFICATION")
            when (verdict) {
                RootVerdict.ROOT_INSTALLED -> AppLog.ok("ROOT INSTALLED (su returned uid=0)")
                RootVerdict.ROOT_NOT_DETECTED -> AppLog.warn("ROOT NOT DETECTED")
                RootVerdict.VERIFICATION_FAILED -> AppLog.error("VERIFICATION FAILED (su or a root manager exists but uid=0 was not confirmed)")
                RootVerdict.DEVICE_NOT_SUPPORTED -> AppLog.error("DEVICE NOT SUPPORTED: ${rep.blockers.joinToString { it.name }}")
            }
            scan.value = ScanState(running = false, step = 7, finished = true)
        }
    }

    // ---------- installation ----------
    fun fetchRelease() {
        if (!consented("internet")) { install.update { it.copy(error = "internet permission declined") }; return }
        viewModelScope.launch(Dispatchers.IO) {
            install.update { it.copy(lookingUp = true, lookupFailed = false, error = null) }
            AppLog.section("INSTALLATION STATUS")
            AppLog.info("Querying official Magisk release (github.com/topjohnwu/Magisk)")
            val rel = MagiskInstaller.fetchLatest()
            if (rel != null) AppLog.ok("Latest release ${rel.tag}: ${rel.assetName}, ${rel.size} bytes, digest ${rel.digest ?: "NOT PUBLISHED"}")
            install.update { it.copy(lookingUp = false, release = rel, lookupFailed = rel == null) }
        }
    }

    /** Downloads and verifies. Call only after the user confirmed the dialog showing source and risks. */
    fun downloadVerified() {
        val rel = install.value.release ?: return
        viewModelScope.launch(Dispatchers.IO) {
            install.update { it.copy(file = FileStatus.DOWNLOADING, progress = 0f, error = null, verifiedFile = null) }
            AppLog.info("Downloading ${rel.assetName}")
            var last = -1
            val res = MagiskInstaller.download(ctx, rel) { d, t ->
                val pct = if (t > 0) (d * 100 / t).toInt() else 0
                if (pct != last) { last = pct; install.update { it.copy(progress = pct / 100f) } }
            }
            when (res) {
                is DownloadResult.Verified -> {
                    AppLog.ok("SHA-256 verified: ${res.sha256}")
                    install.update { it.copy(file = FileStatus.VERIFIED, progress = 1f, verifiedFile = res.file) }
                }
                is DownloadResult.Failed -> {
                    AppLog.error("Download/verification failed: ${res.reason}")
                    install.update { it.copy(file = FileStatus.FAILED, error = res.reason) }
                }
            }
        }
    }

    fun canInstallApk(): Boolean = consented("install") && ctx.packageManager.canRequestPackageInstalls()

    fun installIntent(): Intent? = install.value.verifiedFile?.let { MagiskInstaller.installIntent(ctx, it) }

    // ---------- reboot / re-verification ----------
    /** User confirmed they are about to flash and restart. Verification runs when they return. */
    fun markPendingVerification() {
        prefs.pendingBootCount = bootCount()
        pendingVerification.value = true
        AppLog.info("Pending verification recorded (boot counter ${bootCount()})")
    }

    fun rebootNow() { viewModelScope.launch(Dispatchers.IO) { if (rootConfirmed) RootManager.reboot() } }
    fun dismissPostReboot() { postRebootVerdict.value = null }

    // ---------- management ----------
    fun refreshMgmt() {
        if (!rootConfirmed || !isMagisk) return
        viewModelScope.launch(Dispatchers.IO) {
            mgmt.update { it.copy(loading = true) }
            val verified = RootManager.verifyRoot()
            val canLabel = consented("queryall")
            fun labels(uid: Int): List<String> {
                if (!canLabel) return emptyList()
                val pm = ctx.packageManager
                return pm.getPackagesForUid(uid)?.map { pkg ->
                    runCatching { pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString() + " ($pkg)" }.getOrDefault(pkg)
                } ?: emptyList()
            }
            val pol = RootManager.policies()
            val logs = RootManager.logs()
            mgmt.value = MgmtState(
                loading = false, rootVerified = verified,
                policies = pol.getOrNull()?.map { PolicyRow(it.uid, labels(it.uid), it.policy) } ?: emptyList(),
                policiesError = pol.exceptionOrNull()?.message,
                logs = logs.getOrNull()?.map { LogRow(it, it.packageName.ifBlank { labels(it.fromUid).firstOrNull() ?: "uid ${it.fromUid}" }) } ?: emptyList(),
                logsError = logs.exceptionOrNull()?.message,
                env = RootManager.environment(), integrity = RootManager.integrity(), system = RootManager.systemStatus(),
            )
        }
    }

    fun setPolicy(uid: Int, action: PolicyAction) = viewModelScope.launch(Dispatchers.IO) {
        RootManager.setPolicy(uid, action); withContext(Dispatchers.Main) { refreshMgmt() }
    }

    fun revoke(uid: Int) = viewModelScope.launch(Dispatchers.IO) {
        RootManager.revoke(uid); withContext(Dispatchers.Main) { refreshMgmt() }
    }
}
