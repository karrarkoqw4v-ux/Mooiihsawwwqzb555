package com.rootmaster.app.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.rootmaster.app.MainViewModel
import com.rootmaster.app.PolicyRow
import com.rootmaster.app.R
import com.rootmaster.engine.PolicyAction
import com.rootmaster.engine.RootVerdict
import java.text.DateFormat
import java.util.Date

private sealed interface Pending {
    data class Revoke(val row: PolicyRow) : Pending
    data class Apply(val row: PolicyRow, val action: PolicyAction) : Pending
}

@Composable
fun ManagementScreen(vm: MainViewModel) {
    val rv by vm.rootVerdict.collectAsState()
    val st by vm.mgmt.collectAsState()
    val unavailable = stringResource(R.string.unavailable)
    var pending by remember { mutableStateOf<Pending?>(null) }
    val rooted = rv == RootVerdict.ROOT_INSTALLED

    LaunchedEffect(rooted) { if (rooted && vm.isMagisk) vm.refreshMgmt() }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (!rooted) {
            RMCard { Title(stringResource(R.string.mgmt_locked_title)); Muted(stringResource(R.string.mgmt_locked_body)) }
            return@Column
        }
        if (!vm.isMagisk) {
            RMCard { Title(stringResource(R.string.mgmt_other_title)); Muted(stringResource(R.string.mgmt_other_body)) }
            return@Column
        }
        RMCard {
            Title(stringResource(R.string.mgmt_title))
            st.rootVerified?.let { Chip(stringResource(if (it) R.string.rv_installed else R.string.rv_failed), if (it) RM.Green else RM.Red) }
            if (st.loading) LinearProgressIndicator(Modifier.fillMaxWidth(), color = RM.Blue)
            Muted(stringResource(R.string.mgmt_note))
            ActionButton(stringResource(R.string.verify_root), enabled = !st.loading) { vm.refreshMgmt() }
        }
        RMCard {
            Title(stringResource(R.string.grants))
            st.policiesError?.let { Text(it, color = RM.Red) }
            if (st.policies.isEmpty() && st.policiesError == null) Muted(stringResource(R.string.none_recorded))
            st.policies.forEach { row ->
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(row.apps.ifEmpty { listOf("uid ${row.uid}") }.joinToString(), color = RM.Text)
                    Chip(
                        stringResource(when (row.policy) { PolicyAction.ALLOW -> R.string.pol_allow; PolicyAction.DENY -> R.string.pol_deny; else -> R.string.pol_ask }),
                        when (row.policy) { PolicyAction.ALLOW -> RM.Green; PolicyAction.DENY -> RM.Red; else -> RM.Amber },
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TextButton(onClick = { pending = Pending.Apply(row, PolicyAction.ALLOW) }) { Text(stringResource(R.string.pol_allow)) }
                        TextButton(onClick = { pending = Pending.Apply(row, PolicyAction.DENY) }) { Text(stringResource(R.string.pol_deny)) }
                        TextButton(onClick = { pending = Pending.Revoke(row) }) { Text(stringResource(R.string.revoke), color = RM.Red) }
                    }
                }
            }
        }
        RMCard {
            Title(stringResource(R.string.request_log))
            st.logsError?.let { Muted(stringResource(R.string.log_unavailable) + " ($it)") }
            if (st.logs.isEmpty() && st.logsError == null) Muted(stringResource(R.string.none_recorded))
            st.logs.forEach { l ->
                Text("${DateFormat.getDateTimeInstance().format(Date(l.entry.timeEpoch * 1000))}  ${l.label}  -> ${l.entry.command}", color = RM.Muted)
            }
        }
        RMCard { Title(stringResource(R.string.root_env)); st.env.forEach { KeyValue(it.key, it.value, unavailable) } }
        RMCard { Title(stringResource(R.string.integrity)); st.integrity.forEach { KeyValue(it.key, it.value, unavailable) } }
        RMCard { Title(stringResource(R.string.system_status)); st.system.forEach { KeyValue(it.key, it.value, unavailable) } }
    }

    pending?.let { p ->
        val (title, body, action) = when (p) {
            is Pending.Revoke -> Triple(R.string.revoke, R.string.confirm_revoke, { vm.revoke(p.row.uid); Unit })
            is Pending.Apply -> Triple(R.string.confirm_policy_title, R.string.confirm_policy, { vm.setPolicy(p.row.uid, p.action); Unit })
        }
        AlertDialog(
            onDismissRequest = { pending = null },
            title = { Text(stringResource(title)) },
            text = { Text(stringResource(body)) },
            confirmButton = { TextButton(onClick = { action(); pending = null }) { Text(stringResource(R.string.confirm)) } },
            dismissButton = { TextButton(onClick = { pending = null }) { Text(stringResource(R.string.cancel)) } },
        )
    }
}
