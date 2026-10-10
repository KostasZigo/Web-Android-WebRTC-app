# Commit 7: Upgrade the web app to Angular 22

## What changed

- Upgraded Angular, Material, the CDK, and the build tools from version 19
  through versions 20 and 21 to version 22. The lockfile includes the matching
  packages and TypeScript 6.
- Set Node.js 24.15 or later on the 24 LTS line as the web app's supported
  runtime. Removed TypeScript options that TypeScript 6 no longer accepts.
- Kept the existing change-detection behavior for both components. The app
  and its browser tests now use the same Zone change-detection setup.
- Moved Angular's build cache out of `node_modules` so package updates cannot
  delete a running updater's files. The cache is ignored by Git.

## Why and what this improves

The web app can now build on the supported Node 24 and Angular 22 stack
without changing its call buttons or the signaling messages shared with
Android. The cache change also makes the next Angular update safer.

## Compatibility and remaining work

The browser UI and two-person call flow are unchanged. The older Karma
test runner, Webpack build, and Protractor dependencies still produce
deprecation warnings; their replacement is planned separately. The main
and web setup READMEs still describe the Angular 19/Node 22 checkpoint
and need to be updated in the next approved step.

The production build passes but its initial bundle is 571.58 kB, which
exceeds the unchanged 500 kB warning budget by 71.58 kB. Test coverage is
72.88% of statements and 30.76% of branches; more behavior tests are
needed to reach the planned coverage goals.

## Checks

Run from `Web-app` with Node 24 LTS and Chrome available:

- `npm ci --no-audit --no-fund`: passed.
- `npm test -- --watch=false --browsers=ChromeHeadless --progress=false
  --code-coverage`: 9 browser tests passed.
- `.\node_modules\.bin\tsc.cmd --noEmit --project tsconfig.spec.json`:
  passed.
- `npm run build -- --configuration production --output-path
  <temporary-directory>`: passed with the bundle-size warning above;
  output stayed outside the repository's tracked `dist` files.
