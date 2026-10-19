# Commit 24: Refresh the Android and browser call screens

## What changed

- Centered the Android Connect screen around the existing Saitama image,
  added a short introduction, and made the layout scroll when space is
  limited. The image file and server configuration were not changed.
- Brought the Android title and colors in line with the call screen.
  Made the connection status easier to read and centered the Hang up
  control below the video.
- Gave the browser a lighter call panel, labeled video areas, and
  grouped buttons with larger targets. The controls and their behavior
  remain the same.
- Extended the Android UI test to check that the Saitama image is
  visible and described, and the browser end-to-end check to cover
  video labels and no horizontal overflow at 320 px.

## Why this helps

Both clients present a clearer starting point and easier-to-find call
controls without adding dependencies, changing signaling, or removing
the original artwork.

## Checks

- All 39 browser behavior tests, web lint, and both Playwright
  end-to-end tests passed. A production build and the rebuilt Compose
  image reported a 436.05 kB initial bundle, below the 500 kB budget.
- All 43 Android JVM tests, the debug build, and the API 37 Android
  Studio emulator UI test passed. Android lint reported 0 errors and
  13 warnings.
- All 13 server tests passed, including the rebuilt deployed-page,
  WebSocket upgrade, and signaling relay smoke check.
- From the Compose-deployed browser to the Android Studio API 37 AVD,
  a real call reached `CONNECTED`. Chromium received live Android
  video, Android kept Hang up visible, and browser Hangup ended the
  call on Android. A headless AVD was used after the emulator's
  graphics window exited during testing; a physical phone was not
  tested.
