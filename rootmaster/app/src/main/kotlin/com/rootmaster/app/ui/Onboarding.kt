package com.rootmaster.app.ui

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import com.rootmaster.app.MainViewModel
import com.rootmaster.app.R
import com.rootmaster.app.permissions.PermCategory
import com.rootmaster.app.permissions.PermStatus

@Composable
fun WelcomeScreen(onStart: () -> Unit) {
    Column(
        Modifier.fillMaxSize().background(RM.Black).padding(24.dp).verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("ROOT MASTER", color = RM.Text, fontSize = 34.sp, fontWeight = FontWeight.ExtraBold)
        Text(stringResource(R.string.tagline), color = RM.PurpleLight, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(28.dp))
        RMCard {
            Title(stringResource(R.string.welcome_title))
            Muted(stringResource(R.string.welcome_body))
            Muted(stringResource(R.string.welcome_honesty))
        }
        Spacer(Modifier.height(20.dp))
        ActionButton(stringResource(R.string.start_check), onClick = onStart)
        Spacer(Modifier.height(12.dp))
        LanguageButton()
    }
}

@Composable
fun PermissionsScreen(vm: MainViewModel) {
    val ctx = LocalContext.current
    val permList by vm.perms.collectAsState()
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { vm.refreshPerms() }

    Column(Modifier.fillMaxSize().background(RM.Black).padding(16.dp)) {
        Title(stringResource(R.string.perm_screen_title))
        Muted(stringResource(R.string.perm_screen_intro))
        Spacer(Modifier.height(8.dp))
        LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(permList, key = { it.id }) { p ->
                RMCard {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text(stringResource(p.titleRes), color = RM.Text, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                        Chip(
                            stringResource(when (p.status) {
                                PermStatus.GRANTED -> R.string.st_granted
                                PermStatus.NOT_GRANTED -> R.string.st_not_granted
                                PermStatus.UNSUPPORTED -> R.string.st_unsupported
                            }),
                            when (p.status) { PermStatus.GRANTED -> RM.Green; PermStatus.NOT_GRANTED -> RM.Amber; PermStatus.UNSUPPORTED -> RM.Red },
                        )
                    }
                    Chip(
                        stringResource(when (p.category) {
                            PermCategory.NORMAL -> R.string.cat_normal
                            PermCategory.SPECIAL -> R.string.cat_special
                            PermCategory.SYSTEM -> R.string.cat_system
                        }), RM.PurpleLight,
                    )
                    Muted(stringResource(R.string.why_label) + " " + stringResource(p.reasonRes))
                    if (p.needsDecision) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Box(Modifier.weight(1f)) {
                                ActionButton(stringResource(R.string.allow), color = RM.Blue) {
                                    vm.setConsent(p.id, true)
                                    if (p.status == PermStatus.NOT_GRANTED) vm.settingsIntent(p.id)?.let { ctx.startActivity(it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
                                }
                            }
                            Box(Modifier.weight(1f)) { ActionButton(stringResource(R.string.decline), color = RM.Purple) { vm.setConsent(p.id, false) } }
                        }
                        when (p.consent) {
                            true -> Chip(stringResource(R.string.you_allowed), RM.Green)
                            false -> Chip(stringResource(R.string.you_declined), RM.Amber)
                            null -> Chip(stringResource(R.string.undecided), RM.Muted)
                        }
                    }
                }
            }
        }
        Spacer(Modifier.height(8.dp))
        Muted(stringResource(R.string.confirm_note))
        Spacer(Modifier.height(6.dp))
        ActionButton(stringResource(R.string.confirm_permissions), enabled = permList.isNotEmpty() && vm.allDecided()) { vm.confirmPermissions() }
    }
}
