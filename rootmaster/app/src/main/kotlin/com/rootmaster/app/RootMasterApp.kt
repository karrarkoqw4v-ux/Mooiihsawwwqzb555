package com.rootmaster.app

import android.app.Application
import com.rootmaster.app.core.AppLog

class RootMasterApp : Application() {
    override fun onCreate() {
        super.onCreate()
        AppLog.init(this)
    }
}
