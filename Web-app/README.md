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
port 8000. The browser uses the page's hostname automatically: for example,
http://localhost:4200 connects to `ws://localhost:8000/`, while a browser
visiting by LAN address connects to port 8000 on that LAN address. HTTPS
pages use `wss://` and require a secure WebSocket endpoint. Port 8000 is for
WebSockets, not a web page.

For a server at another address, add a provider for the `SIGNALING_URL`
token (from `./chat/service/data.service`) in `src\app\app.module.ts`:

```typescript
providers: [{ provide: SIGNALING_URL, useValue: 'ws://192.168.1.10:8000/' }]
```

Use `wss://` for HTTPS deployments. Invalid URL schemes are rejected.

## Check changes

Install Playwright's test browser once, then run the headless browser tests
with coverage and the Angular/TypeScript lint rules:

```powershell
npx playwright install chromium
npm run test:ci
npm run lint
```

If Windows reserves Vitest's default port (63315), use a temporary
`vitest-base.config.mjs` in `Web-app` containing
`export default { test: { api: { port: 14001 } } };`, and run
`npm run test:ci -- --runner-config vitest-base.config.mjs`. Choose an
available port and delete the temporary file after the run.

If you already have Chrome installed, you can set `CHROME_BIN` to its
executable path instead of downloading Chromium. The test command runs
Vitest in headless Chromium and writes reports to `coverage\webTerra`;
the current checks require at least 80% statement coverage and 65% branch
coverage. The signaling tests bring branch coverage to 82.03%.

For a production build, choose a folder outside this repository because
`dist` still contains tracked older build files:

```powershell
npm run build -- --configuration production --output-path "$env:TEMP\webrtc-web-build"
```

With this output override, Angular places the browser files in the
`browser` subfolder. Normal builds keep the old `dist\webTerra` asset path.
The current build succeeds but warns that its initial bundle is 577.14 kB,
above the existing 500 kB warning limit. The limit has not been raised.
The old Protractor browser end-to-end tests still need their planned
replacement.
