# Commit 16: Clean up Android calls reliably

## What changed

- Each Android call now has its own work queue. Ending a call closes its
  socket, camera, media tracks, peer connection, and rendering context
  once. The call screen waits for that cleanup before releasing its video
  views and restoring audio settings.
- The socket cancels a connection attempt if the user hangs up before it
  opens. Camera errors and connection failures now end the call instead
  of leaving it running.
- Offers and answers are sent only after WebRTC accepts the local
  description. An invalid remote description fails the call rather than
  trying another offer. Early ICE candidates wait for the remote
  description.
- Added JVM tests for call status, hang-up, connection and SDP failures,
  early ICE, and resource release even when camera shutdown fails.

## Why this helps

The app no longer keeps a shared call thread or leaves camera and
network work running after a call ends. Waiting for WebRTC to accept
the description also avoids sending an offer or answer that the app
could not use.

## Compatibility and remaining work

The call controls and message formats have not changed. A short network
interruption shows Connecting while WebRTC tries to recover; a failed
connection ends the call. The hard-coded server address still needs
the separately approved deployment update. No physical phone-to-browser
call was tested here, so native media behavior still needs that manual
check. The Android JVM suite does not yet enforce a percentage-based
coverage gate.

## Checks

- `:app:testDebugUnitTest :app:assembleDebug :app:lintDebug` passed:
  **38 JVM tests**, a debug APK, **0 lint errors**, and 12 lint warnings.
