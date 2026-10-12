# Task: Choose a repeatable promotion and rollback path

**Goal:** Deployments are reviewed, auditable and reversible without
adding an orchestrator that this two-service app does not need.

**Scope:** First record whether the target environment is still Compose
or already uses Kubernetes. For Compose, version the approved server/web
image digests and use a reviewed promotion and rollback runbook. Only
if a Kubernetes environment and operator already exist, propose a
small GitOps deployment using the team's supported reconciler. Keep
secrets in an approved external manager, not Git.

**Depends on:** [CI release gates](05-ci-release-gates.md),
[verified images](07-container-provenance.md) and
[deployment health checks](08-deployment-observability.md).
Do not install Kubernetes merely to satisfy this task.

**Done when:**
- The platform decision and owner are recorded, with a clear reason to
  use or not use GitOps. Configuration references immutable image
  digests for both services and no plaintext secrets.
- A review shows the exact staging-to-production change; an unhealthy
  release stops promotion and operators can restore the prior digests.
  The `/signaling/` upgrade route and Android-accessible endpoint survive
  promotion and rollback.
- If Kubernetes is chosen, manifests pass schema and policy checks and
  a dry-run reconciliation reports the expected diff. If Compose stays,
  the equivalent runbook and smoke check are the deliverables instead.

**Validate:** Rehearse promotion, a deliberate failed-health rollout,
and rollback in staging. Run the built-page, real-browser WebSocket and
message-relay smoke check for both the new and restored versions.
