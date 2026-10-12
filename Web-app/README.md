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

The production web container builds this app from source, serves it through
Nginx, and proxies `/signaling/` to the server container. Its browser
connects to `ws://<web host and port>/signaling/`, or `wss://` on an HTTPS page,
so browser clients do not need a separate exposed signaling port. From
the repository root, run
`docker compose -f server\docker-compose.yml up --build -d` and open
http://localhost:3000. Android still needs port 8000 on the host's LAN.
See the root README for the deployment smoke test, TLS precautions, and
the manual browser-to-phone checklist.

For a server at another address, add a provider for the `SIGNALING_URL`
token (from `./chat/service/data.service`) in `src\app\app.module.ts`:

```typescript
providers: [{ provide: SIGNALING_URL, useValue: 'ws://192.168.1.10:8000/' }]
```

Use `wss://` for HTTPS deployments. Invalid URL schemes are rejected.

The page requests camera and microphone access when it opens. **Start**
enables the local tracks and preview; **Stop** pauses them without closing
the devices. The caller chosen to offer presses **Call** after matching;
the waiting caller answers incoming offers automatically. **Hangup**
ends the call and releases the camera and microphone. The browser reconnects
after a hang-up or when the other caller leaves, so a later call requests
fresh media. Permission and call errors appear below the videos; press
**Start** again after granting permission in your browser.

## Check changes

Install Playwright's test browser once, then run the headless browser tests
with coverage and the Angular/TypeScript lint rules (including end-to-end
test files):

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
coverage. The signaling and call tests now reach 82.55% branch coverage.

For end-to-end checks, install the server's dependencies too, then run:

```powershell
npm --prefix ..\server ci
npm run e2e
```

Playwright starts the web app on port 4200 and the real signaling server
on port 8000, runs two headless Chromium callers with fake camera and
microphone input, and stops both servers afterward. Stop any servers
already using these ports before running the checks. No physical camera
or phone is needed. Failure screenshots are kept under the ignored
`coverage\playwright` directory.

Build the production browser files from source with:

```powershell
npm run build -- --configuration production
```

Angular writes to `dist\webTerra`. The build output and the old `src\app.zip`
archive are not tracked by Git; the container builds its own fresh copy.
The current build succeeds but warns that its initial bundle is about
580 kB, above the existing 500 kB warning limit. The limit has not been
raised.
