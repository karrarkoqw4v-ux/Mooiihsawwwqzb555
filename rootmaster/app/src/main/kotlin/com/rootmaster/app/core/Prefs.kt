package com.rootmaster.app.core

import android.content.Context

class Prefs(context: Context) {
    private val sp = context.getSharedPreferences("rootmaster", Context.MODE_PRIVATE)

    var onboardingDone: Boolean
        get() = sp.getBoolean("onboarding_done", false)
        set(v) = sp.edit().putBoolean("onboarding_done", v).apply()

    /** permission id -> true (allowed by user) / false (declined by user). Absent = undecided. */
    fun consent(id: String): Boolean? = if (sp.contains("consent_$id")) sp.getBoolean("consent_$id", false) else null
    fun setConsent(id: String, v: Boolean) = sp.edit().putBoolean("consent_$id", v).apply()

    /** Boot counter recorded when the user said they were about to flash/reboot; -1 = nothing pending. */
    var pendingBootCount: Int
        get() = sp.getInt("pending_boot_count", -1)
        set(v) = sp.edit().putInt("pending_boot_count", v).apply()
}
