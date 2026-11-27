package com.rootmaster.app.ui

import android.content.Intent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.rootmaster.app.FileStatus
import com.rootmaster.app.MainViewModel
import com.rootmaster.app.R
import com.rootmaster.app.core.AppLog
import com.rootmaster.engine.*

@Composable
private fun StepRow(text: String, state: String, color: Color) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(text, color = RM.Text, modifier = Modifier.weight(1f)); Chip(state, color)
    }
}

@Composable
fun InstallScreen(vm: MainViewModel) {
    val ctx = LocalContext.current
    val rep by vm.report.collectAsState()
    val probe by vm.probe.collectAsState()
    val rv by vm.rootVerdict.collectAsState()
    val ins by vm.install.collectAsState()
    val pending by vm.pendingVerification.collectAsState()
    val logs by AppLog.entries.collectAsState()
    val perms by vm.perms.collectAsState()
    var confirmDownload by remember { mutableStateOf(false) }
    var confirmReboot by remember { mutableStateOf(false) }
    val magiskInstalled = probe?.managerPackages?.contains("com.topjohnwu.magisk") == true
    val supported = rep?.verdict.let { it != null && it != Verdict.NOT_SUPPORTED }
    val rooted = rv == RootVerdict.ROOT_INSTALLED
    val ok = stringResource(R.string.res_ok); val todo = stringResource(R.string.st_todo)
    val manual = stringResource(R.string.st_manual); val unknown = stringResource(R.string.res_unknown)

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Title("ROOT INSTALLATION")
        RMCard {
            Title(stringResource(R.string.compat_title))
            rep?.let { Chip(stringResource(it.verdict.res()), verdictColor(it.verdict)) } ?: Muted(stringResource(R.string.scanning))
            if (!supported && rep != null) Muted(stringResource(R.string.install_blocked))
        }
        RMCard {
            Title(stringResource(R.string.components))
            Muted(stringResource(R.string.components_note))
            StepRow(stringResource(R.string.comp_magisk_app), if (magiskInstalled) ok else todo, if (magiskInstalled) RM.Green else RM.Amber)
            StepRow(
                stringResource(R.string.comp_release) + (ins.release?.let { " ${it.tag}" } ?: ""),
                when { ins.release != null -> ok; ins.lookupFailed -> stringResource(R.string.res_fail); else -> unknown },
                when { ins.release != null -> RM.Green; ins.lookupFailed -> RM.Red; else -> RM.Muted },
            )
            StepRow(
                stringResource(R.string.comp_digest),
                when { ins.release == null -> unknown; ins.release!!.digest != null -> ok; else -> stringResource(R.string.res_fail) },
                when { ins.release == null -> RM.Muted; ins.release!!.digest != null -> RM.Green; else -> RM.Red },
            )
            StepRow(
                stringResource(R.string.comp_file),
                when (ins.file) { FileStatus.NONE -> todo; FileStatus.DOWNLOADING -> stringResource(R.string.st_running); FileStatus.VERIFIED -> stringResource(R.string.st_verified); FileStatus.FAILED -> stringResource(R.string.res_fail) },
                when (ins.file) { FileStatus.VERIFIED -> RM.Green; FileStatus.FAILED -> RM.Red; FileStatus.DOWNLOADING -> RM.Blue; FileStatus.NONE -> RM.Muted },
            )
            if (ins.file == FileStatus.DOWNLOADING) LinearProgressIndicator(progress = { ins.progress }, Modifier.fillMaxWidth(), color = RM.Blue)
            ins.error?.let { Text(it, color = RM.Red) }
            ActionButton(stringResource(R.string.check_release), enabled = supported && !ins.lookingUp) { vm.fetchRelease() }
            ActionButton(
                stringResource(R.string.install_components),
                enabled = supported && ins.release != null && ins.file != FileStatus.DOWNLOADING && !magiskInstalled,
            ) { confirmDownload = true }
            if (ins.file == FileStatus.VERIFIED) {
                ActionButton(stringResource(R.string.open_installer), color = RM.Purple) {
                    if (!vm.canInstallApk()) vm.settingsIntent("install")?.let { ctx.startActivity(it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
                    else vm.installIntent()?.let { ctx.startActivity(it) }
                }
            }
            if (perms.firstOrNull { it.id == "internet" }?.consent != true) Muted(stringResource(R.string.need_internet_consent))
        }
        RMCard {
            Title(stringResource(R.string.procedure))
            Muted(stringResource(R.string.procedure_note))
            StepRow(stringResource(R.string.step_unlock), when (rep?.checks?.firstOrNull { it.id == CheckId.BOOTLOADER }?.result) {
                CheckResult.PASS -> ok; CheckResult.FAIL -> todo; else -> unknown }, RM.Muted)
            StepRow(stringResource(R.string.step_app), if (magiskInstalled) ok else todo, if (magiskInstalled) RM.Green else RM.Amber)
            StepRow(stringResource(R.string.step_patch), manual, RM.Blue)
            StepRow(stringResource(R.string.step_flash), manual, RM.Blue)
            StepRow(stringResource(R.string.step_verify), if (rooted) ok else todo, if (rooted) RM.Green else RM.Amber)
            rep?.let { Muted(stringResource(R.string.boot_target_label) + ": " + stringResource(it.bootTarget.res())) }
            Text("fastboot flash <boot|init_boot> magisk_patched.img", color = RM.Blue)
            Muted(stringResource(R.string.fastboot_note))
        }
        RMCard {
            Title(stringResource(R.string.reboot_title))
            Muted(stringResource(R.string.reboot_body))
            if (pending) Chip(stringResource(R.string.pending_verification), RM.Blue)
            ActionButton(stringResource(R.string.prepare_reboot), color = RM.Purple) { confirmReboot = true }
        }
        RMCard {
            Title(stringResource(R.string.event_log))
            logs.takeLast(8).forEach { Text(it.message, color = RM.Muted) }
        }
    }

    if (confirmDownload) {
        val rel = ins.release
        AlertDialog(
            onDismissRequest = { confirmDownload = false },
            title = { Text(stringResource(R.string.confirm_download_title)) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(stringResource(R.string.confirm_download_body))
                    if (rel != null) { Text(rel.url, color = RM.Blue); Text("${rel.size / 1024 / 1024} MB, ${rel.digest}") }
                    rep?.risks?.forEach { Text("- " + stringResource(it.res()), color = RM.Amber) }
                }
            },
            confirmButton = { TextButton(onClick = { confirmDownload = false; vm.downloadVerified() }) { Text(stringResource(R.string.download_verify)) } },
            dismissButton = { TextButton(onClick = { confirmDownload = false }) { Text(stringResource(R.string.cancel)) } },
        )
    }
    if (confirmReboot) {
        AlertDialog(
            onDismissRequest = { confirmReboot = false },
            title = { Text(stringResource(R.string.reboot_title)) },
            text = { Text(stringResource(R.string.reboot_dialog_body)) },
            confirmButton = {
                TextButton(onClick = { confirmReboot = false; vm.markPendingVerification(); if (rooted) vm.rebootNow() }) {
                    Text(stringResource(if (rooted) R.string.reboot_now else R.string.i_will_reboot))
                }
            },
            dismissButton = { TextButton(onClick = { confirmReboot = false }) { Text(stringResource(R.string.cancel)) } },
        )
    }
}
