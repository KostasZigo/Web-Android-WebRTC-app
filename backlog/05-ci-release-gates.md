# Task: Run the project checks on every proposed change

**Goal:** A pull request cannot be accepted with a broken browser,
signaling server or Android build.

**Scope:** Add GitHub Actions workflows under `.github\workflows`. Use
supported Node 24, JDK 17, Android SDK 37 and Playwright Chromium. Restore
both npm projects with `npm ci` and Android with the checked-in wrapper;
cache dependencies by lockfile or wrapper, not generated build outputs.
Keep workflow permissions limited and separate checks from publishing.

**Depends on:** None. The existing local suites and Compose smoke test
are the starting commands; do not require a physical phone on hosted CI.

**Done when:**
- Server tests, TypeScript check and build; web coverage tests, lint,
  production build and both Playwright end-to-end calls; and Android JVM
  tests, debug APK and lint run on pull requests and the main branch.
- At least one job builds both images and runs the deployed-page and
  WebSocket smoke test, using a container-capable runner. Failed commands
  fail the workflow; useful test and lint reports are available without
  leaking credentials.
- The workflow uses timeouts and cancels superseded runs. Document the
  required status checks before enabling branch protection. Adopt the
  extra coverage gates from [task 04](04-code-boundaries-and-coverage.md)
  when that task is complete.

**Validate:** Open a test pull request and observe every job. Show one
controlled failing test blocks the check, then restore it and obtain a
green run. Run the manual browser-to-Android checklist separately;
green CI must not be called a physical-device test.
