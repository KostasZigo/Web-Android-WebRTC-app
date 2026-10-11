# Commit 11: Clean up browser calls

## What changed

- The browser now owns one call connection at a time. Repeated **Call**
  clicks do not create extra peers, and **Hangup** closes the peer, clears
  both videos, and stops camera and microphone tracks. The waiting caller
  answers offers instead of sending a competing offer.
- Offers, answers, and ICE candidates wait for the right step in the call.
  A late media request or offer cannot restart a call after hang-up.
- Permission, call, and signaling problems appear under the videos instead
  of opening blocking alerts. A failed permission request can be retried.
- Expected WebSocket closure after hang-up no longer looks like a network
  error. The browser cleans up a lost call and can match again.
- Added browser tests for repeated calls, media cleanup, permission denial,
  early and late messages, failure handling, and disconnects. Updated the
  setup and usage guides.

## Why this helps

Calls no longer leave the camera running or keep old peer connections
around after they end. Incoming ICE and early answers are applied when the
peer is ready. Users can see what went wrong and retry without reloading
the page.

## Compatibility and remaining work

The **Start**, **Stop**, **Call**, and **Hangup** buttons and outgoing message
formats stay the same. **Stop** pauses tracks; **Hangup** releases them.
The existing server still limits connections to one pair at a time. Browser
end-to-end tests and deployment fixes are separate planned commits.

The production build succeeds, but its 580.49 kB initial bundle exceeds
the unchanged 500 kB warning budget by 80.49 kB.

## Checks

- `npm run test:ci -- --runner-config vitest-base.config.mjs`: 37 browser
  tests passed, with 92.51% statements and 82.13% branches. Windows
  reserved Vitest's default port, so the run used a temporary port-14001
  config, which was removed afterward.
- `npm run lint` and `npx tsc --noEmit -p tsconfig.spec.json`: passed.
- `npm test` in `server`: 12 signaling tests passed.
- `npm run build -- --configuration production --output-path
  <outside-repository-directory>`: passed with the size warning above.
