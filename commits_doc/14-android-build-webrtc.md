# Commit 14: Update the Android build and calling library

## What changed

- Updated the Android build to Gradle 9.6, Android Gradle Plugin 9.4.1,
  Java 17, and Android SDK 37. Gradle checks the download's SHA-256 hash.
- Replaced JCenter and the old WebRTC mirror with Google Maven and Maven
  Central. Updated AndroidX, Material, OkHttp, and WebRTC; removed libraries
  the app no longer uses.
- Updated the camera, microphone, and video-rendering code for the current
  WebRTC library. The app still sends the same call messages.
- On Android 17 and later, a call also needs local-network access to reach
  the signaling server. The app asks for it and explains when it is denied.
  Older Android versions still ask only for camera and microphone access.
- Added five JVM tests for camera choice and local-network permission
  decisions. The five existing permission tests remain.

## Why this helps

The Android app now builds with maintained tools and libraries instead of
depending on an outdated WebRTC package and a temporary archive mirror.
The new permission check prevents a call from starting without the local
network access that Android 17 requires.

## Compatibility and remaining work

The minimum Android version is now **Android 6 (API 23)**, up from Android
5 (API 21), because the updated UI libraries require it. The target is
Android 17 (API 37). No signaling message names or call controls changed.
The call-server address is still hard-coded; a later, separately approved
change will make it configurable. A browser-to-phone call on real hardware
has not been tested here. Android lint still reports 12 warnings, including
portrait-only layout and older icon/accessibility resources.

This commit changes **13 files**, above the usual ten-file limit. The
build files, permission screen, and native call code had to move together
to keep the Android app building and calling on the new SDK. The tests and
this note are included in the same commit.

## Checks

- `:app:testDebugUnitTest :app:assembleDebug :app:lintDebug` passed with
  **10 JVM tests**, a debug APK, **0 lint errors**, and 12 lint warnings.
- Gradle build-script setup passed with `--warning-mode all` and no
  deprecation warnings. The debug APK contains the WebRTC native library.
