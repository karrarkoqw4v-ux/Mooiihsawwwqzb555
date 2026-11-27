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

@Composable
fun DashboardScreen(vm: MainViewModel) {
    val dev by vm.device.collectAsState()
    val rv by vm.rootVerdict.collectAsState()
    val rep by vm.report.collectAsState()
    val scan by vm.scan.collectAsState()
    val post by vm.postRebootVerdict.collectAsState()
    val unavailable = stringResource(R.string.unavailable)

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        post?.let { v ->
            RMCard {
                Title(stringResource(R.string.post_reboot_title))
                Chip(stringResource(v.res()), rootColor(v))
                ActionButton(stringResource(R.string.dismiss)) { vm.dismissPostReboot() }
            }
        }
        RMCard {
            Title(stringResource(R.string.root_status))
            if (rv == null) Muted(stringResource(R.string.scanning)) else Chip(stringResource(rv!!.res()), rootColor(rv!!))
            rep?.let { Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { Muted(stringResource(R.string.compat_label)); Chip(stringResource(it.verdict.res()), verdictColor(it.verdict)) } }
            Muted(stringResource(R.string.status_note))
            ActionButton(stringResource(R.string.rescan), enabled = !scan.running) { vm.runScan() }
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
