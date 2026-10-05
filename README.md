# Niqu (ንቁ)

An alarm that actually gets you up: a React web app bundled inside a Capacitor Android shell, with
the parts a browser cannot do pushed down into native code —

- **Exact alarms** through `AlarmManager.setAlarmClock`, planned in Java (`AlarmPlanner`) so they
  survive the app being closed,
- a **foreground ringing service** on the alarm audio stream (`AlarmRingService` + `AlarmTonePlayer`),
- a **puzzle over the lock screen** via a full-screen notification (`showWhenLocked` / `turnScreenOn`),
- **re-arm after reboot** (`BootReceiver` + the `AlarmStore` mirror),
- a **hardware volume-key lock** that holds while the service rings (the Phase 1 lease still runs on
  top of it), and
- a **first launch that must end with an alarm**: the four-step wizard is the only screen until the
  user sets one.

## Get it onto your phone

### Option A — download a build (no tools needed)

1. Open the repository on GitHub → **Actions** → **Build APK** → the newest green run (green tick).
2. Scroll to the bottom of the run page → **Artifacts** → **`niqu-release-apk.zip`** → download it.
3. Unzip it, copy the `.apk` to the phone (USB, Drive, Telegram — anything), and tap it.
4. Android will ask to allow installing from that source: **Settings → Apps → Special access →
   Install unknown apps → (your browser / file manager) → Allow**. On Samsung it is
   **Settings → Security and privacy → Install unknown apps**.

Artifacts expire after 30 days. Any time you want a fresh one: **Actions → Build APK → Run
workflow** (pick `release` or `debug`).

The APK is signed with the **debug key** unless the release keystore secrets are set
(`android/signing/README.md`), so Android will warn that it is from an unknown developer. That is
fine for testing; publishing to Play needs a real keystore.

### Option B — build it yourself

Requirements: **Node 22+**, **JDK 21** (Capacitor 8 compiles with Java 21 — JDK 17 fails with
`invalid source release: 21`), and the **Android SDK** with API 36 (Android Studio installs it).
Point the build at your SDK with the `ANDROID_HOME` environment variable, or create
`android/local.properties` containing `sdk.dir=/path/to/Android/sdk`.

```bash
npm ci
npm test                 # 233 checks: volume lock, scheduler bridge, editor, first run, wizard
npm run build            # the web bundle into dist/
npx cap sync android     # copies dist/ + plugins into the Android project

npm run android:apk      # release APK  -> android/app/build/outputs/apk/release/
npm run android:debug    # debug APK    -> android/app/build/outputs/apk/debug/
```

Or open the `android/` folder in Android Studio and press Run — the same Gradle project CI builds.

No phone tooling at all? `npm run dev` serves the app in a browser. The wizard, the editor and the
reliability panel all work there; alarms ring only while the tab is open, because a browser has no
`AlarmManager` (the app detects this and says so).

## First launch

The wizard runs once, and it is the only screen until it finishes: **set the time → pick a mission →
pick the sound → confirm and save**. Finishing it writes the alarm, replaces the demo alarms the
source ships with, and remembers the run. On Android the last step also asks for the two permissions
the alarm needs to ring with the screen off. Settings → *revisit setup* re-opens the wizard any time
(that run is closable).

## Permissions, and where Android hides them

| What | When it matters | Where to grant it |
|---|---|---|
| Notifications | Android 13+ | The wizard's last step, or Settings → Apps → Niqu → Notifications |
| Alarms & reminders (exact alarms) | **Android 12 only** — on 13+ an alarm app is granted at install | Settings → Apps → Special app access → Alarms & reminders |
| Full screen notifications | Android 14+ | Settings → Apps → Special app access → Full screen notifications |
| Background activity | Samsung / Xiaomi / Huawei battery managers can kill the ring | Settings → Battery → Background usage limits → make sure Niqu is not *sleeping* |

The app itself tells you which of these is off: **Settings → Wake-Up Reliability** shows the exact
alarm, notification and full-screen-intent state, the next armed alarm, the device model, and how
many volume presses the ringing service has swallowed.

## What works where

| | Browser | Android app |
|---|---|---|
| Alarms ring with the app closed | ✗ (JS timer only, tab must be alive) | ✓ exact alarms + foreground service |
| Sound on the alarm stream, screen off | ✗ | ✓ |
| Puzzle over the lock screen | ✗ | ✓ full-screen intent |
| Volume keys blocked while ringing | ✗ (a web page cannot) | ✓ |
| Re-arm after reboot | ✗ | ✓ |
| First-run wizard, editor, reliability panel | ✓ | ✓ |

## Layout

```
src/                React app (Vite + Tailwind)
  components/       AlarmClock, AlarmEditorModal, OnboardingTour, AlarmRingingModal, ...
  utils/            alarmScheduler.ts (native bridge), alarmText.ts, firstRun.ts, volumeLock.ts, ...
tests/              runtime harnesses run by npm test (tsx, no test framework)
android/app/src/main/java/com/esknder/niqu/
                    AlarmScheduler, AlarmPlanner, AlarmRingService, AlarmTonePlayer,
                    AlarmKeyLock, RingSession, AlarmStore, BootReceiver, plugins, MainActivity
android/app/src/test/java/com/esknder/niqu/
                    plain-JVM tests for the pure native logic (no emulator needed)
.github/workflows/build-apk.yml   web tests -> JVM tests -> APK, artifact niqu-<type>-apk
```

## Tests

```bash
npm test              # all web suites
npm run test:lock     # volume-lock lease/heartbeat
npm run test:schedule # native scheduler bridge contract
npm run test:editor   # the simplified editor renders as designed
npm run test:first-run# the first-run gate + the alarm the wizard creates
cd android && ./gradlew :app:testDebugUnitTest   # native logic (needs JDK 21 + SDK)
```

## Honest status

- The Android side has **not been verified on a physical phone yet**: exact-alarm timing, the
  lock-screen takeover, the alarm-stream audio and the key lock all need real hardware (and a real
  OEM ROM) before they can be called done. The JVM tests cover the pure logic only.
- OEM battery managers can still kill the ringing service; whitelisting the app is the only fix.
- The app is English + Amharic; the Amharic strings were added by a non-native speaker and want a
  native review.
