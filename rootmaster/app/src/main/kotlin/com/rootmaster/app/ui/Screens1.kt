package com.rootmaster.app.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.rootmaster.app.MainViewModel
import com.rootmaster.app.R
import com.rootmaster.engine.*

fun verdictColor(v: Verdict): Color = when (v) {
    Verdict.ALREADY_ROOTED, Verdict.READY -> RM.Green
    Verdict.REQUIRES_UNLOCK, Verdict.UNDETERMINED -> RM.Amber
    Verdict.NOT_SUPPORTED -> RM.Red
}

fun rootColor(v: RootVerdict): Color = when (v) {
    RootVerdict.ROOT_INSTALLED -> RM.Green
    RootVerdict.ROOT_NOT_DETECTED -> RM.Amber
    RootVerdict.VERIFICATION_FAILED, RootVerdict.DEVICE_NOT_SUPPORTED -> RM.Red
}

/** The one real "what do I do right now" hint, computed only from state this device actually produced. */
private fun nextStepRes(rep: CompatibilityReport?, rv: RootVerdict?, magiskInstalled: Boolean, pending: Boolean): Int = when {
    rep == null -> R.string.scanning
    rv == RootVerdict.ROOT_INSTALLED -> R.string.next_rooted
    rep.verdict == Verdict.NOT_SUPPORTED -> R.string.next_not_supported
    pending -> R.string.next_reboot_verify
    !magiskInstalled -> R.string.next_install_magisk
    rep.verdict == Verdict.REQUIRES_UNLOCK || rep.verdict == Verdict.UNDETERMINED -> R.string.next_unlock_bootloader
    else -> R.string.next_patch_flash
}

@Composable
fun DashboardScreen(vm: MainViewModel) {
    val dev by vm.device.collectAsState()
    val rv by vm.rootVerdict.collectAsState()
    val rep by vm.report.collectAsState()
    val scan by vm.scan.collectAsState()
    val probe by vm.probe.collectAsState()
    val pending by vm.pendingVerification.collectAsState()
    val post by vm.postRebootVerdict.collectAsState()
    val unavailable = stringResource(R.string.unavailable)
    val magiskInstalled = probe?.managerPackages?.contains("com.topjohnwu.magisk") == true

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        post?.let { v ->
            RMCard {
                Title(stringResource(R.string.post_reboot_title))
                Chip(stringResource(v.res()), rootColor(v))
                ActionButton(stringResource(R.string.dismiss)) { vm.dismissPostReboot() }
            }
        }
        RMCard {
            Title(stringResource(R.string.control_panel_title))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                rv?.let { Chip(stringResource(it.res()), rootColor(it)) }
                rep?.let { Chip(stringResource(it.verdict.res()), verdictColor(it.verdict)) }
            }
            Muted(stringResource(R.string.next_step_label) + " " + stringResource(nextStepRes(rep, rv, magiskInstalled, pending)))
            ActionButton(stringResource(R.string.start_root), enabled = !scan.running) { vm.startRoot() }
            Muted(stringResource(R.string.status_note))
        }
        RMCard {
            Title(stringResource(R.string.device_info))
            if (dev == null) Muted(stringResource(R.string.scanning))
            dev?.rows?.forEach { KeyValue(it.key, it.value, unavailable) }
            Muted(stringResource(R.string.unavailable_note))
        }
    }
}

@Composable
fun CompatibilityScreen(vm: MainViewModel) {
    val rep by vm.report.collectAsState()
    val r = rep
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (r == null) { Muted(stringResource(R.string.scanning)); return@Column }
        RMCard {
            Title(stringResource(R.string.compat_title))
            Chip(stringResource(r.verdict.res()), verdictColor(r.verdict))
            Muted(stringResource(R.string.method_label) + ": " + r.method)
            Muted(stringResource(R.string.boot_target_label) + ": " + stringResource(r.bootTarget.res()))
        }
        RMCard {
            Title(stringResource(R.string.checks))
            r.checks.forEach { c ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(stringResource(c.id.res()), color = RM.Text, modifier = Modifier.weight(1f))
                    Text(c.detail, color = RM.Muted, modifier = Modifier.padding(horizontal = 8.dp))
                    Chip(
                        stringResource(when (c.result) { CheckResult.PASS -> R.string.res_ok; CheckResult.FAIL -> R.string.res_fail; CheckResult.UNKNOWN -> R.string.res_unknown }),
                        when (c.result) { CheckResult.PASS -> RM.Green; CheckResult.FAIL -> RM.Red; CheckResult.UNKNOWN -> RM.Amber },
                    )
                }
            }
            Muted(stringResource(R.string.checks_note))
        }
        if (r.blockers.isNotEmpty()) RMCard {
            Title(stringResource(R.string.blockers)); r.blockers.forEach { Text(stringResource(it.res()), color = RM.Red) }
            Muted(stringResource(R.string.process_stopped))
        }
        if (r.requirements.isNotEmpty()) RMCard {
            Title(stringResource(R.string.requirements)); r.requirements.forEach { Text("- " + stringResource(it.res()), color = RM.Text) }
        }
        if (r.risks.isNotEmpty()) RMCard {
            Title(stringResource(R.string.risks)); r.risks.forEach { Text("- " + stringResource(it.res()), color = RM.Amber) }
        }
    }
}
