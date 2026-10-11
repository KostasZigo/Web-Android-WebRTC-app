# Commit 10: Make browser signaling reliable

## What changed

- Gave incoming signaling messages clear types and checked them in one place.
  The browser now understands Android offers, Android answers, browser
  offers, browser answers, and both ICE candidate formats.
- Removed the fixed personal network address. By default, the browser uses
  port 8000 on the page's hostname. An Angular provider can set another
  WebSocket URL.
- Used the public RxJS WebSocket API. Connections retry after an unexpected
  close, but closing them on purpose cancels retries. Connection and message
  errors reach the UI.
- Added browser tests for message formats, bad messages, busy calls, errors,
  reconnection, and cleanup. Removed lint exceptions the new types no
  longer need. Updated the setup and protocol guides.

## Why this helps

An Android answer used to look like another offer to the browser. The
browser can now finish that handshake without changing the server or either
client's outgoing message format. Users see connection problems, and
closing the page does not leave a reconnect timer behind.

## Compatibility and remaining work

Browser messages on the wire keep their old fields. A browser visiting by
LAN address can now reach the server on that address without editing source
code. HTTPS pages use `wss://` and need a secure endpoint on port 8000, or
an override through `SIGNALING_URL`. Media and peer cleanup remains in the
next planned commit.

The production build succeeds, but the initial 577.14 kB bundle exceeds
the unchanged 500 kB warning budget by 77.14 kB.

## Checks

- `npm run test:ci -- --runner-config vitest-base.config.mjs`: 23 browser
  tests passed; 88.59% statements and 82.03% branches. Windows reserved
  Vitest's default port 63315, so this run used a temporary port-14001
  config. The config was removed afterward; the web README explains the
  workaround.
- `npm run lint` and `npx tsc --noEmit -p tsconfig.spec.json`: passed.
- `npm test` in `server`: 12 server contract tests passed.
- `npm run build -- --configuration production --output-path
  <outside-repository-directory>`: passed with the size warning above.
