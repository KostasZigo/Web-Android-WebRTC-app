# Task: Keep supported dependencies up to date

**Goal:** Small, reviewable updates replace occasional risky upgrades.

**Scope:** Configure scheduled dependency proposals for
`server\package-lock.json`, `Web-app\package-lock.json`,
`Android-app\app\build.gradle`, the Gradle wrapper and both Dockerfiles.
Group compatible patch updates by ecosystem, but keep Angular/TypeScript,
AGP/Gradle/JDK, Android WebRTC and major Node changes separately. Check
the upstream support matrices before merging a major change.

**Depends on:** [CI release gates](05-ci-release-gates.md) must run first
so update proposals have reliable feedback.

**Done when:**
- A scheduled check raises reviewable proposals with changed lockfiles
  or wrapper checksum where appropriate; it never commits generated
  browser output or credentials.
- Major releases require compatibility notes, behavior tests and explicit
  review. No blanket `npm audit fix`, forced install, or automatic major
  merge hides a broken peer dependency or protocol change.
- The update policy explains how to handle a blocked Android/WebRTC
  release, an unavailable artifact, security advisories and rollback.

**Validate:** Reproduce an example npm update with `npm ci` in each JS
project, run the full checks from [task 05](05-ci-release-gates.md), and
build both container images. Exercise one sample Android update with
the checked-in wrapper and record the compatibility evidence.
