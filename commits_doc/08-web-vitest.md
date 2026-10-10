# Commit 8: Run web tests with Vitest

## What changed

- Replaced Karma and Jasmine unit tests with Vitest in headless Chromium.
  The tests still check the visible controls, camera preview, and call
  messages. A new test checks what happens when the other caller leaves.
- Kept shared browser fakes and ran the component tests with the real app
  module, so missing Material UI pieces are no longer hidden from the tests.
- Added `npm run test:ci` for a single test run with V8 coverage reports.
  It fails if statement coverage drops below 80% or branch coverage drops
  below 65%.
- Switched to Angular's supported application build system, which Vitest
  needs. Normal web builds still put files where the current Dockerfile
  expects them. Production builds no longer need to download web fonts.
- Removed the unused Karma setup and its direct dependencies. Protractor
  and its reporter remain until the planned browser end-to-end replacement.

## Why and what this improves

Karma's old build system is deprecated. The new runner keeps the same
behavior checks while making test and coverage runs repeatable on Node 24.
The new build system also removes the web app's Webpack dependency.

## Compatibility and remaining work

The call flow, controls, and signaling messages have not changed. Install
the test browser once with `npx playwright install chromium`. An installed
Chrome can also be used by setting `CHROME_BIN` to its executable path.

Branch coverage is 68.65%, still short of the planned 80% goal for call
and signaling logic. The old Protractor end-to-end target remains for its
separate replacement. The root and web READMEs still describe the earlier
Angular 19 and Karma setup; they need a later approved documentation change.

The production build succeeds with a 573.36 kB initial bundle. This is
73.36 kB over the unchanged 500 kB warning budget.

## Checks

Run from `Web-app` with Node 24 LTS:

- `npm ci --no-audit --no-fund`: passed.
- `npx playwright install chromium`: passed.
- `npm run test:ci`: 10 browser tests passed. Coverage was 81.74%
  statements, 68.65% branches, 80.64% functions, and 78.64% lines.
- `.\node_modules\.bin\tsc.cmd --noEmit --project tsconfig.spec.json`:
  passed.
- `npm run build -- --configuration production --output-path
  <temporary-directory>`: passed with the bundle-size warning above;
  generated files stayed outside the tracked `dist` directory.
- The development server returned the Angular app page over HTTP.
