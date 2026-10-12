# Commit 19: Future work for the call app

## What changed

- Added nine tasks in `backlog` for call usability, restricted-network
  connections, web bundle size, code boundaries and coverage, CI checks,
  dependency updates, release images, deployment operations and
  conditional GitOps.
- Each task points to the relevant code, states what must be done first,
  describes a measurable result and says how to check it.

## Why this helps

Future contributors can pick up one task without guessing which parts of
the app it affects or mistaking a proposed feature for something that
already works. The tasks keep the two-person call behavior and require
proof for device-, network- and deployment-dependent outcomes.

## Compatibility and remaining work

This commit changes documentation only; it does not add TURN, CI,
authentication, TLS or a deployment platform. The production web bundle
still exceeds its 500 kB warning budget. An Android-to-browser call on a
physical device, an HTTPS/WSS deployment and an Android coverage
percentage gate are not yet verified.

## Checks

- All 38 web behavior tests passed with 92.54% statement and 82.55%
  branch coverage. Web lint, the production build and both Playwright
  end-to-end checks passed. The build still warns about the 580.58 kB
  initial bundle.
- All 38 Android JVM tests were run again and passed. The debug APK
  build and Android lint passed.
- The 12 local server tests, TypeScript check and build passed.
  Podman Compose built the server and web images; all 13 server tests
  passed against the running deployment, including the real Chromium
  WebSocket route and message relay. The containers were stopped.
