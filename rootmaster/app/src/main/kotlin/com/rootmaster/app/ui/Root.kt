package com.rootmaster.app.ui

import androidx.appcompat.app.AppCompatDelegate
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.os.LocaleListCompat
import com.rootmaster.app.MainViewModel
import com.rootmaster.app.R
import java.util.Locale

@Composable
fun LanguageButton() {
    TextButton(onClick = {
        val cur = AppCompatDelegate.getApplicationLocales().toLanguageTags()
        val isAr = cur.startsWith("ar") || (cur.isEmpty() && Locale.getDefault().language == "ar")
        AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(if (isAr) "en" else "ar"))
    }) { Text(stringResource(R.string.switch_language), color = RM.Blue) }
}

private enum class Tab(val label: Int) {
    DASH(R.string.nav_device), COMPAT(R.string.nav_compat), INSTALL(R.string.nav_install),
    TERMINAL(R.string.nav_terminal), MANAGE(R.string.nav_manage),
}

@Composable
fun RootMasterRoot(vm: MainViewModel) {
    val done by vm.onboardingDone.collectAsState()
    var showWelcome by rememberSaveable { mutableStateOf(true) }
    when {
        done -> MainScaffold(vm)
        showWelcome -> WelcomeScreen { showWelcome = false }
        else -> PermissionsScreen(vm)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MainScaffold(vm: MainViewModel) {
    var tab by rememberSaveable { mutableStateOf(Tab.DASH) }
    Scaffold(
        containerColor = RM.Black,
        topBar = {
            Row(
                Modifier.fillMaxWidth().background(RM.Black).padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically,
            ) {
                Column {
                    Text("ROOT MASTER", color = RM.Text, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold)
                    Text(stringResource(R.string.tagline), color = RM.PurpleLight, fontSize = 10.sp)
                }
                LanguageButton()
            }
        },
        bottomBar = {
            NavigationBar(containerColor = RM.Surface) {
                Tab.entries.forEach { t ->
                    NavigationBarItem(
                        selected = tab == t, onClick = { tab = t },
                        icon = {
                            Icon(
                                when (t) {
                                    Tab.DASH -> Icons.Default.Home
                                    Tab.COMPAT -> Icons.Default.CheckCircle
                                    Tab.INSTALL -> Icons.Default.Build
                                    Tab.TERMINAL -> Icons.Default.PlayArrow
                                    Tab.MANAGE -> Icons.Default.Lock
                                }, contentDescription = null,
                            )
                        },
                        label = { Text(stringResource(t.label), fontSize = 10.sp, maxLines = 1) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = RM.Text, selectedTextColor = RM.Blue, indicatorColor = RM.Purple,
                            unselectedIconColor = RM.Muted, unselectedTextColor = RM.Muted,
                        ),
                    )
                }
            }
        },
    ) { pad ->
        Box(Modifier.padding(pad).fillMaxSize()) {
            when (tab) {
                Tab.DASH -> DashboardScreen(vm)
                Tab.COMPAT -> CompatibilityScreen(vm)
                Tab.INSTALL -> InstallScreen(vm)
                Tab.TERMINAL -> TerminalScreen(vm)
                Tab.MANAGE -> ManagementScreen(vm)
            }
        }
    }
}
