# Commit 20: Configure the Android call server at build time

## What changed

- Kept the Connect screen free of server-address controls or saved
  settings. The button starts a call without requiring configuration from
  the user.
- The developer supplies the endpoint at build time: debug defaults to
  the Compose server via the Android emulator's host alias; release has
  an explicit placeholder to replace with a secure public gateway URL.
- Invalid build addresses show a clear configuration error. Added JVM
  endpoint checks and an emulator Connect-screen test, and updated setup
  and deployment instructions.

## Why this helps

Normal users no longer need to know how the app reaches the server.
Developers can build for an emulator, a LAN phone, or a staging or
production gateway without embedding anyone's personal LAN IP in code.
Kubernetes Pod IP changes are handled behind the gateway and Service.

## Compatibility and remaining work

Debug builds accept `ws://` for a trusted local server; release builds
require `wss://` and a real address in `releaseSignalingUrl`. The release
placeholder fails the build rather than producing an unusable app.
Changing either build's address requires another build; there is no
remote configuration or service discovery.
Existing call controls and signaling messages are unchanged. Production
TLS, authentication, TURN and multi-replica signaling remain separate
backlog work.

## Checks

- All 42 Android JVM tests passed; an API 37 emulator UI test confirmed
  that Connect opens a call without asking the user for a URL. Its first
  attempt was blocked by an unresponsive emulator System UI; the test
  passed after isolating and restarting the emulator.
- The debug APK and a release APK supplied with a secure example URL
  built successfully. A release build with the placeholder failed with
  an actionable Gradle error. Lint reported 0 errors and 12 warnings.
- Compose served the web page and signaling port. The emulator app
  connected to its signaling server using the debug default; a second
  WebSocket caller received a match, confirming the app's connection.
- A call to a deployed Kubernetes gateway and a physical phone call
  require a reachable deployment and device.
