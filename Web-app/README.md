# Web client

This Angular 22 app connects a browser to the two-person WebRTC signaling
server. Use Node.js 24.15 or later on the 24 LTS line.

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

Install Playwright's test browser once, then run the headless browser tests
with coverage and the Angular/TypeScript lint rules:

```powershell
npx playwright install chromium
npm run test:ci
npm run lint
```

If you already have Chrome installed, you can set `CHROME_BIN` to its
executable path instead of downloading Chromium. The test command runs
Vitest in headless Chromium and writes reports to `coverage\webTerra`;
the current checks require at least 80% statement coverage and 65% branch
coverage. Branch coverage is 68.65%, short of the longer-term 80% goal.

For a production build, choose a folder outside this repository because
`dist` still contains tracked older build files:

```powershell
npm run build -- --configuration production --output-path "$env:TEMP\webrtc-web-build"
```

With this output override, Angular places the browser files in the
`browser` subfolder. Normal builds keep the old `dist\webTerra` asset path.
The current build succeeds but warns that its initial bundle is 573.36 kB,
above the existing 500 kB warning limit. The limit has not been raised.
The old Protractor browser end-to-end tests still need their planned
replacement.
