# Task: Bring the production web bundle under its budget

**Goal:** Load the call page with less JavaScript and CSS without
changing what a caller can do.

**Scope:** The production build currently reports a 580.58 kB initial
bundle against a 500 kB warning budget in `Web-app\angular.json`. Inspect
the bundle before removing imports or changing Angular Material modules
under `Web-app\src\app`. Keep the current camera, signaling and error
behavior. Do not hide the warning by raising the limit.

**Depends on:** None. [CI release gates](05-ci-release-gates.md) can later
publish the build report on each change.

**Done when:**
- `npm run build -- --configuration production` reports an initial bundle
  at or below **500 kB** without changing that budget.
- The main page and both video controls still work in a browser; no
  dependencies are removed solely because a static search missed their
  runtime use.
- Record before/after build sizes and the largest source of the saving in
  the change note. If the threshold cannot be met safely, report the
  measured blocker rather than claiming a partial reduction is done.

**Validate:** From `Web-app`, run the production build, `npm run test:ci`,
`npm run lint` and `npm run e2e`. Repeat the container web build and
deployed browser smoke test to catch missing production assets.
