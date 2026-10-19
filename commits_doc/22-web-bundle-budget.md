# Commit 22: Bring the web bundle under its budget

## What changed

- Removed the unused Angular router: it had no routes or links but still
  loaded routing code into the call page.
- Replaced two empty Material sidenav containers with one page element.
  The toolbar, video grid, Material buttons, and call controls remain.
- Extended browser tests to check both video views and controls in the
  simplified page, including a 320 px viewport. Marked the backlog task
  complete.

## Why this helps

The production page loaded routing and sidenav code that callers could
not use. Removing those dependencies and their supporting code reduced
the initial JavaScript from 442.20 kB to 296.11 kB. The initial bundle
fell from **580.58 kB to 434.49 kB**, a saving of 146.09 kB; estimated
transfer fell from 124.20 kB to 93.48 kB. The unchanged 500 kB warning
budget is now met with 65.51 kB to spare. Bundle statistics confirmed
that routing and sidenav code no longer appear in the main bundle.

## Compatibility and checks

- The same two-person call protocol, camera behavior, controls, theme,
  and Android app are retained. No dependencies or budget limits were
  changed.
- All 39 browser behavior tests passed with 92.43% statement and
  82.27% branch coverage. Web lint and both Playwright end-to-end tests
  passed, including the 320 px control check.
- The source-built Compose web image reported a 434.49 kB initial
  bundle without a budget warning. All 13 server tests passed,
  including the deployed Chromium page, WebSocket upgrade, and message
  relay check; server type-check passed.
- The Android Studio API 37 emulator passed its UI test after its
  System UI initially stopped responding during a concurrent image
  build. All 43 Android JVM tests, the debug APK build, and lint
  passed; lint reported 0 errors and 12 warnings.
- A call using the Compose-deployed browser and server reached
  `CONNECTED` on the Android Studio emulator. Chromium displayed live
  Android video at 480 x 640, showed no call error, and Hangup ended
  the call on Android. No physical device or production TLS endpoint
  was tested.
