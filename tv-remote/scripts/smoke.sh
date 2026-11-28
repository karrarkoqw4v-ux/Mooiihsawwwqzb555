#!/usr/bin/env bash
# يثبّت الـ APK على المحاكي ويشغله ويطبع الأخطاء وواجهة الشاشة
set -x
adb install -r TV-Raymond.apk
adb logcat -c
adb shell monkey -p com.raymond.tv -c android.intent.category.LAUNCHER 1
for t in 4 10 18; do
  sleep $((t==4 ? 4 : 6))
  echo "=== t~${t}s pid: $(adb shell pidof com.raymond.tv || echo DEAD)"
done
echo "=== UI DUMP ==="
adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; adb shell cat /sdcard/ui.xml | tr '>' '>\n' | grep -oE '(text|content-desc)="[^"]+"' | head -40
echo "=== LOGCAT (errors) ==="
adb logcat -d | grep -E "AndroidRuntime|FATAL|ReactNativeJS|SIGABRT|libc  |E/unknown:React" | head -80
adb exec-out screencap -p > screen.png || true
