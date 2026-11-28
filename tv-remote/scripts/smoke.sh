#!/usr/bin/env bash
# اختبار حقيقي على محاكي أندرويد بنفس مقاس شاشتك: تشغيل، بحث عن تلفزيون Roku وهمي، اتصال، إرسال أوامر
set +e
FAIL=0
snap() {  # لقطة مصغرة تُطبع في السجل بصيغة base64 لأقرأها
  echo "=== SNAP $1 ==="
  adb exec-out screencap -p | convert png:- -resize 200x -quality 50 jpg:- | base64 -w0; echo
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
adb shell cmd locale set-app-locales com.raymond.tv --locales ar-IQ || echo 'locale set failed'
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
# بعد الاتصال: نجد مركز لوحة اللمس (كلمة OK بداخلها) ونجرّب لمسة وسحبات بالاتجاهات الأربعة
sleep 3
dump
adb shell wm size; adb shell wm density
if python3 scripts/tap_text.py "OK" > ok.txt; then
  read CX CY < ok.txt; echo "touchpad centre: $CX $CY"
  adb shell input tap $CX $CY; sleep 0.8
  adb shell input swipe $CX $((CY+130)) $CX $((CY-130)) 300; sleep 0.8
  adb shell input swipe $CX $((CY-130)) $CX $((CY+130)) 300; sleep 0.8
  adb shell input swipe $((CX-130)) $CY $((CX+130)) $CY 300; sleep 0.8
  adb shell input swipe $((CX+130)) $CY $((CX-130)) $CY 300; sleep 1
else
  echo "FAIL: touchpad OK label not found"; FAIL=1
fi
snap 4_after_keys
# ===== شاشة مشاركة الكمبيوتر: نفتحها من الإعدادات ونتأكد أنها تظهر ولا تكرش =====
dump; python3 scripts/tap_text.py "الإعدادات" > g.txt && adb shell input tap $(cat g.txt) || echo "WARN: settings gear not found"
sleep 2; dump
python3 scripts/tap_text.py "مشاركة الكمبيوتر" > r.txt && adb shell input tap $(cat r.txt) || { echo "FAIL: pc-share row not found in settings"; FAIL=1; }
sleep 3; dump
python3 scripts/tap_text.py "Allow" > al.txt && adb shell input tap $(cat al.txt) && sleep 2 && dump   # نافذة صلاحية البلوتوث إن ظهرت
echo "--- pc-share screen ---"; texts
snap 5_pc_share
if ! texts | grep -qE "اختر الكمبيوتر|البلوتوث|أندرويد|اقتران"; then echo "FAIL: pc-share screen content missing"; FAIL=1; fi
echo "=== FAKE ROKU LOG ==="; cat roku.log | sort | uniq -c | head -20
for k in Up Down Left Right Select; do grep -q "keypress/$k" roku.log || { echo "FAIL: $k did not reach TV"; FAIL=1; }; done
grep -q "POST /keypress" roku.log || { echo "FAIL: no key reached the TV"; FAIL=1; }
grep -q "device-info" roku.log || { echo "FAIL: TV never discovered"; FAIL=1; }
echo "pid end: $(adb shell pidof com.raymond.tv || echo DEAD)"; adb shell pidof com.raymond.tv >/dev/null || FAIL=1
echo "=== LOGCAT ==="; adb logcat -d | grep -iE "AndroidRuntime|FATAL|ReactNative|Hermes|SIGABRT|Unhandled|Invariant|TypeError|ReferenceError|not implemented" | grep -v "uiautomator\|Monkey" | head -60
echo "RESULT FAIL=$FAIL"
kill $SRV 2>/dev/null
exit $FAIL
