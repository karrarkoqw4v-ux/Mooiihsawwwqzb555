# Verification status

| Item | State |
|---|---|
| `engine` module compiles and its 14 unit tests pass (JVM, Kotlin 2.0.21) | Verified |
| `app` module (Compose UI, Android layer) | **Written but NOT compiled or run** in the authoring environment, because the Android SDK / Google Maven are unreachable there. Build with the GitHub Actions workflow or Android Studio and fix any compile error that appears. |
| Debug APK | **Not built** |
| Behaviour on a real device (su probe, Magisk commands, installer flow) | **Not tested** |

Known limits: `magisk --sqlite` output format and the presence of a request-log table vary between Magisk versions; the
app shows an error/"unavailable" instead of guessing. The partition list is usually unreadable for normal apps.
