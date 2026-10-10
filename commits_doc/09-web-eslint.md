# Commit 9: Replace TSLint with ESLint

## What changed

- Added the Angular 22 ESLint setup and `npm run lint`. It checks the web
  app's TypeScript files and HTML templates, including accessibility rules.
  The old TSLint file is gone.
- Removed unused imports, a dead variable, and an unused hang-up argument
  from the chat component. The call behavior is unchanged.
- Kept lint exceptions limited to specific old files. They cover the
  module-based components, the signaling types and service, and two test
  stubs. New files still get the recommended rules.
- Updated both setup READMEs with Angular 22, Node 24, Playwright browser
  tests, coverage, lint, and the current bundle-size warning.

## Why and what this improves

TSLint is no longer maintained. ESLint gives the web app a working lint
command and checks templates as well as TypeScript, without changing the
two-person call flow or its wire messages. The narrow exceptions let us
clean up the old signaling and call code in their planned commits rather
than hide lint errors across the whole app.

## Compatibility and remaining work

Use Node.js 24.15 or later on the 24 LTS line. The old Protractor end-to-end
target still needs replacing. The signaling service and message types still
have file-specific lint exceptions; remove these as they are refactored.

The build succeeds, but its 573.34 kB initial bundle exceeds the unchanged
500 kB warning budget by 73.34 kB. Branch coverage is 68.65%, below the
longer-term 80% goal.

## Checks

Run from `Web-app` with Node 24 LTS and Playwright Chromium installed:

- `npm ci --no-audit --no-fund`: passed.
- `npm run lint`: passed for TypeScript and templates.
- `npm run test:ci`: 10 browser tests passed. Coverage was 81.66%
  statements and 68.65% branches, above the current 80% and 65% floors.
- `.\node_modules\.bin\tsc.cmd --noEmit --project tsconfig.spec.json`:
  passed.
- `npm run build -- --configuration production --output-path
  <temporary-directory>`: passed with the bundle-size warning above;
  output stayed outside the repository's tracked `dist` files.
