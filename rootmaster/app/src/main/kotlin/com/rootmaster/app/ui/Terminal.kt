package com.rootmaster.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rootmaster.app.MainViewModel
import com.rootmaster.app.R
import com.rootmaster.app.core.AppLog
import com.rootmaster.app.core.Level
import com.rootmaster.app.core.LogEntry
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val mono = FontFamily.Monospace
private val fmt = SimpleDateFormat("HH:mm:ss", Locale.US)

@Composable
private fun TermLine(e: LogEntry, animate: Boolean) {
    val color: Color = when (e.level) {
        Level.INFO -> Color(0xFFD0D0D0); Level.OK -> RM.Green; Level.WARN -> RM.Amber
        Level.ERROR -> RM.Red; Level.SECTION -> RM.PurpleLight
    }
    val full = if (e.level == Level.SECTION) "== ${e.message} ==" else "${fmt.format(Date(e.time))}  ${e.message}"
    var shown by remember(e.id) { mutableIntStateOf(if (animate) 0 else full.length) }
    LaunchedEffect(e.id) {
        if (animate) { val step = maxOf(1, full.length / 60); while (shown < full.length) { shown = minOf(full.length, shown + step); delay(8) } }
    }
    Text(
        full.take(shown) + if (shown < full.length) "_" else "", color = color, fontFamily = mono, fontSize = 12.sp,
        fontWeight = if (e.level == Level.SECTION) FontWeight.Bold else FontWeight.Normal,
    )
}

@Composable
fun TerminalScreen(vm: MainViewModel) {
    val logs by AppLog.entries.collectAsState()
    val scan by vm.scan.collectAsState()
    val openedAt = remember { logs.lastOrNull()?.id ?: 0L }
    val state = rememberLazyListState()
    LaunchedEffect(logs.size) { if (logs.isNotEmpty()) state.animateScrollToItem(logs.size - 1) }

    Column(Modifier.fillMaxSize().background(Color.Black).padding(12.dp)) {
        Text("ROOT MASTER TERMINAL", color = RM.Green, fontFamily = mono, fontWeight = FontWeight.Bold, fontSize = 16.sp)
        Spacer(Modifier.height(6.dp))
        // Determinate: fraction of the real scan steps that have finished.
        LinearProgressIndicator(progress = { scan.progress }, Modifier.fillMaxWidth(), color = RM.Green, trackColor = RM.Card)
        Text("${scan.step}/${scan.total}", color = RM.Muted, fontFamily = mono, fontSize = 11.sp)
        Spacer(Modifier.height(6.dp))
        LazyColumn(Modifier.weight(1f), state = state) {
            items(logs, key = { it.id }) { TermLine(it, animate = it.id > openedAt) }
        }
        Spacer(Modifier.height(8.dp))
        ActionButton(stringResource(R.string.rerun_diag), enabled = !scan.running, color = RM.Purple) { vm.runScan() }
    }
}
