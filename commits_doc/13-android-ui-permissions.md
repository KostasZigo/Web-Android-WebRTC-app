# Commit 13: Make the Android call screen safer

## What changed

- Switched both screens to view binding and removed the old synthetic-view
  and Anko libraries.
- A call now starts only when **both** camera and microphone access are
  granted. Incomplete permission replies cannot start a call.
- Added clear messages for a denied permission, a busy call, and a peer
  leaving. The hang-up button now has a readable label.
- The call screen restores audio settings when it closes and ignores late
  status updates. Removed duplicate and unnecessary permission entries
  from the manifest.
- Added five JVM tests for permission decisions and call-status messages.
  Pinned the JUnit version and removed the unused EasyPermissions library.

## Why this helps

The app no longer tries to use the microphone after only the camera is
allowed. People see a useful reason when they cannot join a call. View
binding also replaces view APIs that are no longer maintained.

## Compatibility and remaining work

The call flow, signaling messages, Android SDK level, and native WebRTC
version are unchanged. The old WebRTC package has disappeared from the
usual repositories, so this module uses an archive mirror for **only that
package**. Replace the old package and remove the mirror during the
separately approved Android dependency update. The hard-coded call-server
address also remains for a later change. No physical-device call was
tested in this commit.

## Checks

- Gradle 6.5 on Java 11, with Android SDK 30:
  `:app:testDebugUnitTest --tests com.example.kotlinhelloworld.CallUiPolicyTest`
  passed (5 tests).
- `:app:assembleDebug :app:lintDebug` passed. Lint reported 15 warnings,
  mostly for the older dependencies scheduled for an update.
- The archived WebRTC package matched the mirror's published checksum.
  A temporary local Java truststore was used to validate HTTPS on this
  machine; it is not part of the repository.
