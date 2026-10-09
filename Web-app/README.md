# Web client

This Angular 19 app connects a browser to the two-person WebRTC signaling
server. Use Node.js 22 LTS for this checkpoint.

## Start the app

From `Web-app`:

```powershell
npm ci
npm start
```

Open http://localhost:4200. The signaling server must also be running on
port 8000. Set `WS_ENDPOINT` in `src\app\chat\service\data.service.ts` to
`ws://localhost:8000/` for a server on the same computer, or use its LAN
address for a separate device. Port 8000 is for WebSockets, not a web page.

## Check changes

Run the browser tests with Chrome installed:

```powershell
npm test -- --watch=false --browsers=ChromeHeadless
```

If Chrome is not found automatically on Windows, set `CHROME_BIN` to its
executable path first. For a production build, choose a folder outside this
repository because `dist` still contains tracked older build files:

```powershell
npm run build -- --configuration production --output-path "$env:TEMP\webrtc-web-build"
```

The current build succeeds but warns that its initial bundle is 533.16 kB,
above the existing 500 kB warning limit. The limit has not been raised.
Linting and browser end-to-end tests still need their planned replacements
for TSLint and Protractor. Node.js 24 LTS becomes the web target after the
planned Angular 22 upgrade.
