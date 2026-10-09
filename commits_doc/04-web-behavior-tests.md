# Test what the web app does

## What changed

The web tests now check the heading people see, the Start and Stop buttons,
the Call and Hangup buttons, an incoming offer, and messages sent and received
over a WebSocket. Shared browser fakes let the tests run without a camera or
a signaling server.

## Why this helps

The old tests mostly checked that a component existed. One expected a welcome
page that was deleted long ago. These tests give us useful checks before
upgrading Angular and changing the call code.

## Compatibility

Only tests changed. The app and its messages work the same as before.

## Checks

The 7 Angular tests passed in Chrome Headless with a temporary Node 12
toolchain. The test TypeScript check also passed. Coverage is now reported:
69.83% of statements and 40% of branches across the current web app. The
later signaling and call updates will cover the remaining important paths.
Node 12 is used only to run this old test toolchain, not as the new target.
