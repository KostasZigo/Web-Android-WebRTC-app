# Commit 6: Upgrade the web app to Angular 19

## What changed

- Upgraded Angular, its build tools, Material, and the CDK from version 16 to
  19, one major version at a time. The npm lockfile now includes the matching
  versions.
- Replaced the removed legacy Material button module so Start, Stop, Call,
  and Hangup still work. Angular's migration marked the two module-based
  components as not standalone.
- Ran the call-control tests with real Material buttons and added a test
  that checks the four controls are available.
- Updated the main README and web setup guide with the current Node version,
  commands, and unfinished tooling.

## Why and what this improves

The old Material button module is not available on newer Angular versions.
Moving to the supported button keeps the familiar call controls usable and
allows the rest of the web upgrade to continue.

## Compatibility and remaining work

The button styling may look slightly different, but the control names, call
flow, and signaling messages are unchanged. Node 20 was used for the older
intermediate migrations; the finished Angular 19 app was checked on Node 22
LTS. Node 24 is planned after the Angular 22 upgrade. The old Karma and
Protractor setup remains for now.

The production build succeeds, but its 533.16 kB initial bundle is 33.16 kB
over the existing 500 kB warning limit. The limit was kept so the size
increase remains visible for later performance work.

## Checks

Run from `Web-app` with Node 22 LTS and Chrome available:

- `npm ci --no-audit --no-fund`: passed.
- `npm test -- --watch=false --browsers=ChromeHeadless --progress=false`:
  9 tests passed.
- `.\node_modules\.bin\tsc.cmd --noEmit --project tsconfig.spec.json`: passed.
- `npm run build -- --configuration production --output-path <temporary-directory>`:
  passed with the bundle-size warning above; output stayed outside the
  repository's tracked `dist` files.
