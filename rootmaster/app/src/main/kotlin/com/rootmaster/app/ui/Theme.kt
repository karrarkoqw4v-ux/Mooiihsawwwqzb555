package com.rootmaster.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

object RM {
    val Black = Color(0xFF000000)
    val Surface = Color(0xFF0D0B14)
    val Card = Color(0xFF16121F)
    val Purple = Color(0xFF5B2A9E)
    val PurpleLight = Color(0xFF8E5CF0)
    val Blue = Color(0xFF3D8BFF)
    val Green = Color(0xFF2ECC71)
    val Red = Color(0xFFFF4D4D)
    val Amber = Color(0xFFF5A623)
    val Text = Color(0xFFFFFFFF)
    val Muted = Color(0xFFA9A3B8)
}

private val scheme = darkColorScheme(
    primary = RM.Blue, onPrimary = Color.White, secondary = RM.Purple, background = RM.Black, surface = RM.Surface,
    onBackground = RM.Text, onSurface = RM.Text, error = RM.Red, surfaceVariant = RM.Card, onSurfaceVariant = RM.Muted,
)

@Composable
fun RootMasterTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = scheme, content = content)
}

@Composable
fun RMCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier.fillMaxWidth()
            .background(RM.Card, RoundedCornerShape(14.dp))
            .border(1.dp, RM.Purple.copy(alpha = 0.45f), RoundedCornerShape(14.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp), content = content,
    )
}

@Composable
fun Title(text: String) = Text(text, color = RM.Text, fontSize = 18.sp, fontWeight = FontWeight.Bold)

@Composable
fun Muted(text: String) = Text(text, color = RM.Muted, fontSize = 13.sp)

@Composable
fun Chip(text: String, color: Color) {
    Text(
        text, color = color, fontSize = 12.sp, fontWeight = FontWeight.SemiBold,
        modifier = Modifier.border(1.dp, color, RoundedCornerShape(50)).padding(horizontal = 10.dp, vertical = 3.dp),
    )
}

@Composable
fun KeyValue(key: String, value: String?, unavailable: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
        Text(key, color = RM.Muted, fontSize = 13.sp, modifier = Modifier.weight(0.4f))
        Text(value ?: unavailable, color = if (value == null) RM.Amber else RM.Text, fontSize = 13.sp, modifier = Modifier.weight(0.6f))
    }
}

@Composable
fun ActionButton(text: String, enabled: Boolean = true, color: Color = RM.Blue, onClick: () -> Unit) {
    Button(
        onClick = onClick, enabled = enabled, modifier = Modifier.fillMaxWidth(),
        colors = ButtonDefaults.buttonColors(containerColor = color, disabledContainerColor = RM.Card, disabledContentColor = RM.Muted),
        shape = RoundedCornerShape(12.dp),
    ) { Text(text, fontWeight = FontWeight.SemiBold) }
}
