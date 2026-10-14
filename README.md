# Android and Web video call application with WebRTC

Hybrid application for real-time peer to peer communication between Android and Web through signaling NodeJS server. Web part is developed with Angular framework and the Android part with Kotlin on Android Studio.


## Motivation

The project was inspired and developed within the framework of an internship and it aims to tackle the lack of easy access documentation about WebRTC on native android development and it's compatibility with web applications.

## Requirements

- Node.js 24.15 or later on the 24 LTS line for both the signaling server
  and the Angular 22 web client.
- Android Studio with JDK 17 and Android SDK 37 for the Android client
  (Android 6 / API 23 or later).

## Getting started

Clone the repository and start the signaling server:

```text
git clone https://github.com/KostasZigo/Web-Android-WebRTC-app.git
cd Web-Android-WebRTC-app\server
npm ci
npm run build
npm start
```

The server listens on port 8000 by default. Set `PORT` to a different port
before starting it if needed. For live server development, use `npm run dev`.
Run `npm test` from `server` to check matching and message relay.

In another terminal, using Node.js 24 LTS, start the web client:

```text
cd Web-Android-WebRTC-app\Web-app
npm ci
npm start
```

Open **http://localhost:4200** for the web interface. Port 8000 accepts
WebSocket connections at **ws://localhost:8000/**, not ordinary HTTP pages.
Seeing **Upgrade Required** at http://localhost:8000 is expected.

To check web changes from `Web-app`, run `npm run lint`. Install the test
browser with `npx playwright install chromium`, then run `npm run test:ci`
for the headless browser tests and coverage report. See
[`Web-app\README.md`](Web-app/README.md) for build instructions.

The development browser connects to `ws://<page hostname>:8000/`. The
production browser connects through its own web origin at `/signaling/`,
using `wss://` when the page uses HTTPS. To override either address, provide
`SIGNALING_URL` as described in [`Web-app\README.md`](Web-app/README.md).
The Android app gets its signaling address from the **build**, not its
users. Debug builds default to `ws://10.0.2.2:8000/`: from an Android
emulator, `10.0.2.2` reaches the host's port 8000, exposed by Compose.
For a physical phone, build with a developer-supplied address for the
host on the same trusted LAN, for example from `Android-app`:

```powershell
.\gradlew.bat :app:assembleDebug '-PdebugSignalingUrl=ws://192.168.1.10:8000/'
```

The release address is initially `REPLACE_WITH_PRODUCTION_WSS_URL`; a
release build fails until developers supply a real `wss://` Gateway/Ingress
hostname, for example:

```powershell
.\gradlew.bat :app:assembleRelease '-PreleaseSignalingUrl=wss://calls.example.com/signaling/'
```

Both properties can also be supplied in a developer's untracked Gradle
properties or by the release pipeline. An invalid development address
shows a configuration error when starting a call. The hostname remains
stable while Kubernetes Services route traffic to changing Pod IPs;
neither Android users nor the app need to discover individual Pods.
`localhost` on a phone means the phone itself.

## Run the production web and server images

From the repository root, use Docker Compose (or `podman compose` with a
Compose provider installed):

```powershell
docker compose -f server\docker-compose.yml up --build -d
```

Open **http://localhost:3000/** on the host. The web image builds Angular
from source and proxies `/signaling/` to the Node server; the browser needs
only port 3000. Port 8000 remains available for Android phones on the LAN.
The server is WebSocket-only, so **Upgrade Required** at
http://localhost:8000/ is normal. Stop the services with:

```powershell
docker compose -f server\docker-compose.yml down
```

For browsers on other devices, use an HTTPS front end that also proxies
WebSocket upgrades at `/signaling/`; browsers generally block camera and
microphone access on non-localhost HTTP origins. The supplied Compose setup
has no TLS or authentication: do not expose it directly to the public
internet. Use a firewall to limit Android's port 8000 to a trusted network.

To check a running deployment, install dependencies in **both** `server`
and `Web-app`, install the Playwright Chromium browser, and set
`DEPLOYMENT_URL` to its web origin before running server tests. This
checks the built page, real browser WebSocket route, and message relay:

```powershell
npm --prefix server ci
npm --prefix Web-app ci
cd Web-app
npx playwright install chromium
cd ..
$env:DEPLOYMENT_URL = 'http://127.0.0.1:3000/'
npm --prefix server test
Remove-Item Env:DEPLOYMENT_URL
```

The smoke test is skipped when `DEPLOYMENT_URL` is not set. For the other
automated checks, run `npm --prefix server run typecheck`,
`npm --prefix Web-app run lint`, `npm --prefix Web-app run test:ci`, and
`npm --prefix Web-app run e2e` with the container services stopped
(the local end-to-end check starts its own server on port 8000). With
JDK 17 and Android SDK 37 installed, check Android from `Android-app`:

```powershell
cd Android-app
.\gradlew.bat :app:testDebugUnitTest :app:assembleDebug :app:lintDebug
```

With an emulator or Android device booted, run
`.\gradlew.bat :app:connectedDebugAndroidTest` from `Android-app` to
confirm that Connect opens a call without asking the user for an address.
The UI test does not need a deployed server or a physical phone.

For a manual cross-device call: start Compose, build Android with the
host's LAN address as `debugSignalingUrl`, and connect the phone to that
network. Connect Android **first** and grant camera and microphone access
(and local-network access on Android 17+). Then open the page on the host
at `localhost:3000`, allow browser camera/microphone access, and press
**Start** and **Call**. Confirm local and remote
video/audio on both devices, **Hangup**, and a second call without
restarting either client. Try a third caller while a pair is active; it
should see the busy notice. A real phone and a reachable LAN are needed
for this manual check.

The message names and examples shared by both clients are in
[`protocol\README.md`](protocol/README.md).

## Usage

#### Android Usage
 1. Run the Android app and press the ***CONNECT*** button.
 2. You will connect to the first available user and communication will be started.
 3. You can press the red button to hang up at any time.

#### Web Usage
 1. Open localhost:4200 for development or localhost:3000 for Compose.
 2. Press ***Start*** to enable your camera and microphone; ***Stop*** pauses
    their tracks without releasing the devices.
 3. Once matched, the offering caller presses ***Call***. The waiting caller
    answers automatically. Connection and permission errors appear below
    the videos.
 4. Press ***Hangup*** to end the call and release your camera and microphone.
    Use ***Start*** or ***Call*** to request them again.

## Reference

+ [droid roulette](https://github.com/agilityfeat/droid-roulette)
+ [Wolfgang Liegel](https://github.com/wliegel/youtube_webrtc_tutorial) - [Angular WebRTC]

## Contributors

+ [Konstantinos Zigogiannis Mplionas](https://github.com/KostasZigo)
+ [Konstantinos Kyratsous](https://github.com/KonstantinosKyratsous)
+ [Vasiliki Kanakari](https://github.com/vasilikikan)
