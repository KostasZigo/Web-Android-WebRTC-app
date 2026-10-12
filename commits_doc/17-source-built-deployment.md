# Commit 17: Build and run the web app from source

## What changed

- Compose now builds the server and web app from their own folders. It no
  longer mounts source folders over the running apps.
- The web image installs its locked dependencies, builds Angular for
  production, and serves the new files with Nginx. The server image
  already built its source with Node 24.
- Nginx forwards `/signaling/` WebSocket connections to the server.
  Production browsers use the same host and port as the web page; local
  development still uses port 8000.
- Added a deployment smoke test for the built page, the browser's actual
  WebSocket address, and browser/Android message relay. Updated the
  setup instructions and a manual phone-to-browser call checklist.

## Why this helps

The container deployment now works from a fresh checkout instead of
needing old checked-in web build files. Browser callers can reach the
signaling server through the web address without changing a personal
network IP in the browser code.

## Compatibility and remaining work

Compose serves the web page at `http://localhost:3000/` and exposes
port 8000 for Android on the local network. The phone's server address
still needs to be set to the host's reachable LAN address before building
the Android app. The supplied containers do not provide HTTPS or
authentication; use a trusted LAN, and put a TLS-enabled proxy in front
of the web service for remote browser camera access. The tracked older
web build files are left for the next separately approved cleanup.
No physical phone call or HTTPS/WSS deployment was tested.

## Checks

- Both images built from source with Podman Compose and started
  successfully. All **13 server tests** passed while the deployment ran,
  including the built-page, Chromium, and WebSocket smoke test. The
  containers were stopped afterward.
- All **38 web behavior tests** passed (92.54% statements, 82.55%
  branches), along with web lint and both browser end-to-end checks.
  Server TypeScript checking also passed.
- The production web build still warns about its 500 kB initial-bundle
  budget (580.58 kB); the warning limit was not changed.
