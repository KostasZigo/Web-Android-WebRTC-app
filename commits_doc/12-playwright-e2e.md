# Commit 12: Replace the old browser checks

## What changed

- Replaced the Protractor welcome-page test with Playwright checks for the
  real video chat page. The tests use two browser pages to make a call
  through the real signaling server, then check media and hang-up cleanup.
- Playwright starts and stops both local servers for the tests. It uses
  fake camera and microphone input, so no device is needed.
- Removed Protractor, its old configuration and page object, Jasmine's
  reporter, and the unused e2e `ts-node` dependency. The existing
  Playwright package runs the tests. Updated `npm run e2e`, lint, the e2e
  TypeScript settings, and the web setup guide.

## Why this helps

The former browser test checked a page that no longer exists. The new
checks exercise what users see and do, including a real two-person call.
The test servers are disposable and the e2e command also checks the test
code's types.

## Compatibility and remaining work

Use Node.js 24 LTS, install the web and server dependencies, and install
Playwright Chromium. Ports 4200 and 8000 must be free while `npm run e2e`
runs. The app and its signaling messages are unchanged. The Android client
and deployment are covered by later commits.

The production build succeeds, but its 580.49 kB initial bundle exceeds
the unchanged 500 kB warning budget by 80.49 kB.

## Checks

- `npm ci --no-audit --no-fund` in `Web-app`: passed.
- `npm run e2e`: two Playwright tests passed, including a two-browser call;
  a second run passed too. Both test servers stopped after each run.
- `npm run lint` and TypeScript checks for browser and e2e tests: passed.
- `npm run test:ci -- --runner-config vitest-base.config.mjs`: 37 browser
  tests passed with 92.51% statements and 82.13% branches. Windows
  reserved Vitest's default port, so this run used a temporary port-14001
  config, which was removed afterward.
- `npm test` in `server`: 12 signaling tests passed.
- `npm run build -- --configuration production --output-path
  <outside-repository-directory>`: passed with the size warning above.
