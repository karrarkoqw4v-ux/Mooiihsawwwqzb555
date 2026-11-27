package com.rootmaster.app

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import com.rootmaster.app.ui.RootMasterRoot
import com.rootmaster.app.ui.RootMasterTheme

class MainActivity : AppCompatActivity() {
    private val vm: MainViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { RootMasterTheme { RootMasterRoot(vm) } }
    }
}
