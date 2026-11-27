package com.rootmaster.app.permissions

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import com.rootmaster.app.R
import com.rootmaster.app.core.Prefs

enum class PermCategory { NORMAL, SPECIAL, SYSTEM }
enum class PermStatus { GRANTED, NOT_GRANTED, UNSUPPORTED }

data class PermItem(
    val id: String,
    val category: PermCategory,
    val titleRes: Int,
    val reasonRes: Int,
    val status: PermStatus,
    /** null = the user has not decided yet. Unsupported items need no decision. */
    val consent: Boolean?,
) {
    val needsDecision: Boolean get() = status != PermStatus.UNSUPPORTED
}

class PermissionManager(private val context: Context, private val prefs: Prefs) {

    private fun manifestGranted(name: String) =
        context.checkSelfPermission(name) == PackageManager.PERMISSION_GRANTED

    fun snapshot(): List<PermItem> {
        fun normal(id: String, perm: String, t: Int, r: Int) = PermItem(
            id, PermCategory.NORMAL, t, r,
            if (manifestGranted(perm)) PermStatus.GRANTED else PermStatus.NOT_GRANTED, prefs.consent(id),
        )

        fun unsupported(id: String, t: Int, r: Int) =
            PermItem(id, PermCategory.SYSTEM, t, r, PermStatus.UNSUPPORTED, null)

        return listOf(
            normal("internet", "android.permission.INTERNET", R.string.perm_internet, R.string.perm_internet_why),
            normal("netstate", "android.permission.ACCESS_NETWORK_STATE", R.string.perm_netstate, R.string.perm_netstate_why),
            normal("queryall", "android.permission.QUERY_ALL_PACKAGES", R.string.perm_queryall, R.string.perm_queryall_why),
            PermItem(
                "install", PermCategory.SPECIAL, R.string.perm_install, R.string.perm_install_why,
                if (context.packageManager.canRequestPackageInstalls()) PermStatus.GRANTED else PermStatus.NOT_GRANTED,
                prefs.consent("install"),
            ),
            unsupported("reboot", R.string.perm_reboot, R.string.perm_reboot_why),
            unsupported("secure", R.string.perm_secure, R.string.perm_secure_why),
            unsupported("root", R.string.perm_root, R.string.perm_root_why),
        )
    }

    fun setConsent(id: String, allowed: Boolean) = prefs.setConsent(id, allowed)

    /** True once every grantable item has an explicit user decision. This says nothing about root. */
    fun allDecided(items: List<PermItem>): Boolean = items.filter { it.needsDecision }.all { it.consent != null }

    fun settingsIntentFor(id: String): Intent? = when (id) {
        "install" -> Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
        else -> null
    }
}
