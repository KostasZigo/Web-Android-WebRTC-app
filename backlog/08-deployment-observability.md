# Task: Operate a secure, diagnosable call deployment

**Goal:** Operators can deploy and diagnose calls without hard-coded
personal addresses or public unauthenticated signaling.

**Scope:** Add a supported Android signaling-address setting in
`VideoCallActivity.kt` instead of the current embedded LAN IP.
Define a TLS front end for the web origin and its `/signaling/` WebSocket
route; keep Android's signaling URL reachable and use `wss://` with a
trusted certificate outside a trusted local development setup. Decide
how callers are authorized and rate-limited before exposing the single
pair server publicly. Add internal health/readiness checks and minimal
metrics for waiting, active, busy and failed connections.

**Depends on:** [CI release gates](05-ci-release-gates.md) before a public
rollout. [Image provenance](07-container-provenance.md) should be ready
before promoting public images. TURN credentials for
[network recovery](02-turn-and-network-recovery.md) must use this
deployment's approved secret-distribution design.

**Done when:**
- A staging browser loads over HTTPS and opens `wss://<same host>/signaling/`
  through the proxy; Android can select that environment without editing
  source or storing a password in the app.
- An unauthenticated or rate-limited caller cannot consume the only call
  slot. Health checks distinguish a running process from a ready
  signaling route without changing the existing WebSocket wire messages.
- Operators can see connection counts, errors and a bounded recovery
  runbook. Logs and metrics do not contain SDP, ICE, TURN secrets or raw
  media. The published instructions cover TLS rotation, firewall rules
  for port 8000 and a rollback.

**Validate:** Run the deployed browser smoke test against HTTPS/WSS,
exercise allowed and rejected callers, and complete the manual
browser-to-Android checklist on staging. Check health behavior when the
server is down and confirm neither logs nor artifacts expose secrets.
