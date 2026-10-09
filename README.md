# Android and Web video call application with WebRTC 

Hybrid application for real-time peer to peer communication between Android and Web through signaling NodeJS server. Web part is developed with Angular framework and the Android part with Kotlin on Android Studio.


## Motivation

The project was inspired and developed within the framework of an internship and it aims to tackle the lack of easy access documentation about WebRTC on native android development and it's compatibility with web applications.

## Requirements

- Node.js 24.15 or later on the 24 LTS line for the signaling server.
- Android Studio for the Android client.
- The web client is still on Angular 11, which requires an older, now unsupported
  Node.js version. Use a compatible Node version only for local development
  until the planned Angular upgrade is complete.

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

In another terminal, using a Node version compatible with the current Angular
11 project, start the web client:

```text
cd Web-Android-WebRTC-app\Web-app
npm ci
npm start
```

Open **http://localhost:4200** for the web interface. Port 8000 accepts
WebSocket connections at **ws://localhost:8000/**, not ordinary HTTP pages.
Seeing **Upgrade Required** at http://localhost:8000 is expected.

For a browser on the server machine, set `WS_ENDPOINT` in
`Web-app\src\app\chat\service\data.service.ts` to `ws://localhost:8000/`.
For Android, set `BACKEND_URL` in `VideoCallActivity.kt` to your computer's
LAN IP address: `localhost` on a phone means the phone itself. The current
`server\docker-compose.yml` still needs its web build path fixed; do not use
it as a working two-service deployment yet.

The message names and examples shared by both clients are in
[`protocol\README.md`](protocol/README.md).

## Usage

#### Android Usage
 1. Run the Android app and press the ***CONNECT*** button.
 2. You will connect to the first available user and communication will be started.
 3. You can press the red button to hang up at any time.

#### Web Usage
 1. Enter localhost:4200 from your browser to connect to the application.
 2. In order to open your camera press the ***Start*** button and to close it press the ***Stop*** button.
 3. Press the ***Call*** button to start the communication with the first available user.
 4. Press the ***Hangup*** button to stop the communication.

## Reference

+ [droid roulette](https://github.com/agilityfeat/droid-roulette)
+ [Wolfgang Liegel](https://github.com/wliegel/youtube_webrtc_tutorial) - [Angular WebRTC]

## Contributors

+ [Konstantinos Zigogiannis Mplionas](https://github.com/KostasZigo)
+ [Konstantinos Kyratsous](https://github.com/KonstantinosKyratsous)
+ [Vasiliki Kanakari](https://github.com/vasilikikan)
