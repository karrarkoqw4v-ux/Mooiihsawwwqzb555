# ROOT MASTER — Advanced Android Root Management

Native Android app (Kotlin, Jetpack Compose) that inspects a device, evaluates whether an
**official** rooting path (Magisk boot-image patch) is possible, guides the user through it, and manages
root grants once root has been verified for real.

Principle: **nothing is simulated.** A normal Android app cannot give itself root, cannot flash partitions and
cannot bypass bootloader protection. ROOT MASTER does not try to. Every status comes from a real check;
anything the system will not let an app read is shown as "Unavailable".

## Modules

| Module | Location | Role |
|---|---|---|
| Engine (pure Kotlin, unit-tested) | `engine/` | Compatibility rules, root classification, Magisk DB parsing/safe SQL, SHA-256 digest check |
| UI layer | `app/.../ui` | Compose screens: Welcome, Permissions, Device, Compat, Install, Terminal, Management |
| Permission Manager | `app/.../permissions` | Real permission status + separate user decision per permission |
| Device Information | `app/.../device` | Build props, kernel, ABI, RAM, storage, battery, bootloader / Verified Boot / SELinux when readable |
| Root Compatibility Engine | `engine/CompatibilityEngine.kt` | Per-vendor/per-device verdict, blockers, requirements, risks |
| Root Status Verification | `app/.../root/RootDetector.kt` + `engine/RootClassifier.kt` | Root = `su -c id` returned `uid=0(root)`, exit 0, no timeout |
| Installer | `app/.../root/MagiskInstaller.kt` | Official Magisk APK from `github.com/topjohnwu/Magisk` only, SHA-256 verified before install |
| Root Management | `app/.../root/RootManager.kt` | Magisk grants / request log / environment / integrity, via `magisk --sqlite` over `su` |
| Terminal + Logging | `ui/Terminal.kt`, `core/AppLog.kt` | Black terminal; progress = scan steps really completed |

## Build

Requirements: JDK 17, Android SDK (platform 35), network access to Google Maven.

```
./gradlew :engine:test          # unit tests, no Android SDK needed for this module alone
./gradlew :app:assembleDebug    # APK at app/build/outputs/apk/debug/
```

Or open `rootmaster/` in Android Studio. The repo's GitHub Actions workflow
(`.github/workflows/rootmaster-build.yml`) runs the tests and builds the debug APK and uploads it as an artifact.

## What the app really does, and what it cannot do

Works inside the app:
- Permission screen with real status and separate Allow/Decline per permission. "Confirm permissions" only records
  decisions; it never implies root.
- Device information from Android APIs and readable system properties; missing values are labelled unavailable.
- Compatibility verdict (Already rooted / Ready / Requires unlock / Not supported / Undetermined) with blockers,
  requirements and risks; unsupported devices are stopped.
- Root detection by actually running `su -c id` (the root manager will show its own prompt).
- Download of the official Magisk APK after an explicit confirmation dialog; installed only if the SHA-256 equals the
  digest GitHub publishes for the asset. If no digest is published the file is refused.
- Post-reboot re-verification: the app records the boot counter when you announce a restart and re-checks root
  when it sees the counter changed.
- Management (only when root is verified and the manager is Magisk): verify root, list grants, allow / deny / revoke
  (each confirmed), request log when the Magisk version keeps one, environment, file integrity, system status.

Requires action outside the app (the app says so and does not fake it):
- Unlocking the bootloader (manufacturer procedure; **wipes all data**).
- Patching the stock boot/init_boot image (Magisk app) and flashing it with fastboot/Odin from a computer.
- Restarting the device when it is not yet rooted (the app can restart only through verified root, after confirmation).
- KernelSU / APatch management (detected, but managed in their own apps).

## Languages
English and Arabic (RTL), switchable from the header. Device property names in the Device tab and terminal log lines
stay in English on purpose (technical identifiers).

## Verification status
See `STATUS.md`.
