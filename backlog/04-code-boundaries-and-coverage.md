# Task: Make call logic easier to change safely

**Goal:** Keep signaling and call-state changes testable without adding
layers that the two-person app does not need.

**Scope:** Examine `Android-app\app\src\main\java\com\example\kotlinhelloworld\videoCall`,
`Web-app\src\app\chat` and `server\src\roulette.ts` for duplicated state
decisions and unclear ownership. Refactor only a specific behavior or
cleanup problem found there; keep Android native resources and browser
media behind narrow seams. Add a coverage report and meaningful gates
for server signaling and Android protocol/state logic. The browser already
enforces 80% statements and 65% branches globally.

**Depends on:** None. Pair the resulting coverage commands with
[CI release gates](05-ci-release-gates.md) once they pass locally.

**Done when:**
- A caller's matching, answer, error, peer-left and Hangup outcomes do
  not change; the shared protocol fixtures still pass on both clients.
- Server signaling reaches at least **85% statements and branches**;
  Android protocol and state logic reaches at least **80% branches**.
  Reports and enforced gates cover the actual modules, not only helpers.
- Any native renderer or Android framework code omitted from a JVM
  coverage gate is named with a reason and a device-test plan.
  Tests assert visible outcomes, not private fields.

**Validate:** Run server tests, TypeScript check and build; browser tests,
lint and end-to-end calls; Android JVM tests, debug build and lint. Inspect
the coverage reports and deliberately break a tested behavior to verify
each new gate fails before considering it complete.
