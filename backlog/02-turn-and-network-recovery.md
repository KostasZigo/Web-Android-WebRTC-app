# Task: Keep calls working on restricted networks

**Goal:** Callers can connect when a direct peer-to-peer route is blocked,
and a temporary network loss does not leave media running indefinitely.

**Scope:** Both clients currently use STUN only:
`Web-app\src\app\chat\chat.component.ts` and
`Android-app\app\src\main\java\com\example\kotlinhelloworld\videoCall\VideoCallSession.kt`.
Plan and test an optional TURN relay with short-lived credentials.
Add bounded reconnect or ICE-restart behavior only where WebRTC state
requires it; keep Hangup final and preserve the existing signaling
messages unless a documented, tested extension is necessary.

**Depends on:** [Secure deployment and configuration](08-deployment-observability.md)
must provide a safe way to issue and rotate TURN credentials. Do not put
long-lived TURN passwords in source, images or a public browser bundle.

**Done when:**
- In a controlled test with direct peer traffic blocked, a browser and
  Android device complete a call through a selected relay candidate.
  A normal direct call still works without requiring TURN.
- A temporary connection loss reaches a clear recovering or failed state
  within a documented time limit. Hangup releases tracks, camera and
  socket, and neither client retries after intentional Hangup.
- Credential lifetime, rotation, relay cost limits and failure messages
  are documented without publishing secrets or SDP/ICE payloads.

**Validate:** Add behavior tests for lost connectivity, retry limits and
cleanup on both clients. Run their existing automated suites and the
deployed WebSocket smoke test. Record a two-device call on a restricted
test network and confirm the relay path using WebRTC connection stats;
do not count a STUN-only test as proof of TURN.
