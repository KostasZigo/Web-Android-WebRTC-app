# Commit 5: Upgrade the web app to Angular 16

## What changed

- Upgraded Angular, its build tools, and Material one major version at a time from 11 to 16. Updated the npm lockfile.
- Kept the current button style, updated the browser test setup, and removed old browser-polyfill instructions.
- Added a test for a failed call offer. The app now shows the failure and closes that connection even when the error is not an `Error` object.
- Put Angular's build cache inside the ignored `node_modules` folder.
- Removed the old lint command and its TSLint/Codelyzer packages. Angular 16 no longer provides the lint builder they used.

## Why and what this improves

The older Angular tools blocked later dependency upgrades. This is a tested step toward the supported web stack without changing the call controls or signaling messages. Failed offers now produce a visible error instead of leaving a broken connection.

## Compatibility and remaining work

Node 16 was used for this temporary migration checkpoint; it is not the planned production runtime. The web app still needs the later Angular upgrades before using Node 24. One indirect package warns that it requires Node 18, but the install, tests, and build completed on Node 16. The lint command will return with ESLint in the planned lint step. Karma and Protractor remain until their planned replacements.

## Checks

Run from `Web-app` with Node 16 and Chrome available:

- `npm ci --no-audit --no-fund`: passed.
- `npm test -- --watch=false --browsers=ChromeHeadless --progress=false`: 8 tests passed.
- `.\node_modules\.bin\tsc.cmd --noEmit --project tsconfig.spec.json`: passed.
- `npm run build -- --configuration production --output-path <temporary-directory>`: passed; initial bundle 482.54 kB. The build output was kept outside the repository's tracked `dist` files.
