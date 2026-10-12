# Task: Make call setup and controls easier to use

**Goal:** A first-time caller can tell what to do next and can operate the
call with a keyboard or screen reader.

**Scope:** Review the browser controls, status and error messages in
`Web-app\src\app\chat\chat.component.html` and its styles. Review Android's
call layout, strings and activity in `Android-app\app\src\main`. Keep
Start, Stop, Call and Hangup behavior and the two-person protocol. Show
waiting, busy, permission-denied and reconnecting states clearly; avoid
offering an action that cannot currently succeed. Make the video layout
work at narrow widths and on large Android screens rather than relying on
the current portrait lock.

**Depends on:** None. Coordinate any Android server-address setting with
[the deployment task](08-deployment-observability.md) so the same setting
is not built twice.

**Done when:**
- All controls have meaningful accessible names, visible focus, sufficient
  contrast and usable touch targets; call status is announced without
  repeatedly interrupting the user.
- At a 320 px browser width, 200% browser zoom, and enlarged Android text,
  videos, error messages and Hangup remain visible and operable.
- Browser permission denial, busy pairing, peer departure and a second
  call show a clear next action. Android shows equivalent states without
  losing its Hangup control.

**Validate:** Extend the existing browser component and Playwright tests
for keyboard navigation, visible status and a small viewport; run
`npm run test:ci`, `npm run e2e` and `npm run lint` from `Web-app`.
Run the Android JVM tests, debug build and lint with `.\gradlew.bat`
from `Android-app`. Manually check TalkBack and a desktop screen reader
on a real call; record any device-dependent limitation.
