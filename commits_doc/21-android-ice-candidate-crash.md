# Commit 21: Keep Android calls open when ICE candidates arrive

## What changed

- Fixed the Android peer-connection observer so a newly gathered ICE
  candidate is forwarded to signaling once instead of calling the
  observer method again.
- Added a JVM test for forwarding a candidate once and ignoring a null
  candidate.

## Why this helps

The old callback name collided with the WebRTC observer method. During
an actual call it called itself until the Java stack overflowed; WebRTC
then aborted the app because the exception escaped through its native
callback. The camera screen disappeared and Android returned to the
Connect screen. The fix lets the call continue through ICE negotiation
without changing the signaling format or how the server address is set.

## Checks

- All 43 Android JVM tests passed. The debug APK built, and Android lint
  reported 0 errors and 12 warnings.
- A browser served by the Compose web container and the Android 15
  16 KB-page emulator completed a real media call: Android reported
  `CONNECTED`, Chromium displayed live Android video at 480 x 640,
  neither client showed a call error, and browser hang-up produced the
  Android call-ended notice. No native abort occurred on this call.
- The Compose signaling room was already occupied, so this media test
  used a temporary local signaling instance on port 8001, a test-only
  Android debug address, and a browser test-only WebSocket address.
  The temporary server was stopped, the regular debug APK with
  `ws://10.0.2.2:8000/` was rebuilt and reinstalled, and the Compose
  containers were left running. The occupied Compose room, a physical
  device, and production TLS were not part of this media test.
