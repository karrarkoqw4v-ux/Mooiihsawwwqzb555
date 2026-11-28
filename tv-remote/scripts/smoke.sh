#!/usr/bin/env bash
# اختبار حقيقي على محاكي أندرويد بنفس مقاس شاشتك: تشغيل، بحث عن تلفزيون Roku وهمي، اتصال، إرسال أوامر
set +e
FAIL=0
snap() {  # لقطة مصغرة تُطبع في السجل بصيغة base64 لأقرأها
  echo "=== SNAP $1 ==="
  adb exec-out screencap -p | convert png:- -resize 260x -quality 55 jpg:- | base64 -w0; echo
  echo "=== END SNAP ==="
}
dump() {
  rm -f ui.xml
  for i in 1 2 3 4 5; do
    adb shell rm -f /sdcard/ui.xml
    adb shell uiautomator dump /sdcard/ui.xml 2>&1 | tail -2
    adb pull /sdcard/ui.xml ui.xml >/dev/null 2>&1 && [ -s ui.xml ] && return 0
    sleep 2
  done
  echo "dump failed"; adb shell dumpsys window | grep -E "mCurrentFocus|mFocusedApp" | head -3
}
texts() { python3 -c "
import xml.etree.ElementTree as ET
for n in ET.parse('ui.xml').iter('node'):
    t=(n.get('text') or n.get('content-desc') or '').strip()
    if t: print('  UI:', t)
"; }

python3 scripts/fake_roku.py >/dev/null 2>&1 </dev/null &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
sleep 1
adb shell wm size 1268x2756; adb shell wm density 440
adb install -r TV-Raymond.apk || FAIL=1
adb logcat -c
adb shell monkey -p com.raymond.tv -c android.intent.category.LAUNCHER 1
sleep 9
echo "pid: $(adb shell pidof com.raymond.tv || echo DEAD)"
snap 1_after_launch
dump; echo "--- screen after launch ---"; texts
python3 scripts/tap_text.py "اتصال بالتلفاز" > pos.txt || { echo "FAIL: remote screen not shown"; FAIL=1; }

if [ -s pos.txt ]; then
  adb shell input tap $(cat pos.txt)
  sleep 4;  snap 2_searching
  sleep 14; snap 3_after_search
  dump; echo "--- screen after search ---"; texts
fi
# بعد الاتصال نضغط على نقاط على خط الشاشة الوسطي ليصيب أزرار الأسهم/OK
sleep 3
W=1268; H=2756
for y in 1000 1100 1200 1300 1400 1500 1600 1700; do adb shell input tap $((W/2)) $y; sleep 0.4; done
sleep 2
snap 4_after_keys
echo "=== FAKE ROKU LOG ==="; cat roku.log | sort | uniq -c | head -20
grep -q "POST /keypress" roku.log || { echo "FAIL: no key reached the TV"; FAIL=1; }
grep -q "device-info" roku.log || { echo "FAIL: TV never discovered"; FAIL=1; }
echo "pid end: $(adb shell pidof com.raymond.tv || echo DEAD)"; adb shell pidof com.raymond.tv >/dev/null || FAIL=1
echo "=== LOGCAT ==="; adb logcat -d | grep -E "AndroidRuntime|FATAL|ReactNativeJS|SIGABRT" | head -60
echo "RESULT FAIL=$FAIL"
kill $SRV 2>/dev/null
exit $FAIL
