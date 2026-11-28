# خطة المشروع: ريموت التلفزيون (Expo / React Native)

## الهيكل
```
tv-remote/
  App.tsx              الراوتر (?route=… للمعاينة على الويب)
  src/theme.ts         الألوان
  src/store.ts         الحالة (zustand): الأجهزة، التطبيقات، الإعدادات
  src/nav.tsx          تنقل بسيط (stack)
  src/tv/driver.ts     واجهة TvDriver الموحدة   <- هنا نضيف Samsung/LG/AndroidTV/Roku
  src/tv/mock.ts       سائق تجريبي
  src/components/      DPad, NumPad, BottomPanel, AppsRow, common
  src/screens/         RemoteScreen, SettingsScreens, Sheets, ui
  docs/screens/        لقطات التصميم
.github/workflows/build-apk.yml   بناء APK على GitHub
```
## المراحل
1. [تم] الأساس + الواجهة + اكتشاف الشبكة + سائقين Roku/Samsung/LG (بدون اختبار على تلفزيون حقيقي)
2. اتصال حقيقي: سائق واحد حسب نوع تلفزيونك (Samsung/LG WebSocket، Roku HTTP، Android TV مشفّر)
3. اكتشاف الأجهزة (mDNS/SSDP) والاقتران وحفظها (MMKV)
4. الميكروفون، إبقاء الشاشة، الضغط المطوّل، وضع المسرح فعلياً
5. الاشتراك (RevenueCat) والإعلانات (AdMob)
6. اختبار على أجهزة حقيقية + نشر
## ملاحظات
- الاتصال بالشبكة المحلية يحتاج Dev Build/APK وليس Expo Go.
- بناء APK: Actions > Build Android APK > Run workflow ثم تنزيل tv-remote-apk.
