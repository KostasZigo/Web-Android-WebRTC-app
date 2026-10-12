# Task: Make release images traceable and verifiable

**Goal:** A deployed image can be tied to reviewed source and rebuilt
or rolled back without guessing which tag it contains.

**Scope:** Extend the CI release process for `server\Dockerfile`,
`Web-app\Dockerfile` and `server\docker-compose.yml`. Pin reviewed base
image digests, publish immutable image digests from protected releases,
attach a software bill of materials and build provenance, and use
short-lived CI identity for signing where a registry supports it.
Keep development Compose convenient, but do not deploy a mutable
`latest` tag.

**Depends on:** [CI release gates](05-ci-release-gates.md). Coordinate
digest promotion with [deployment operations](08-deployment-observability.md).

**Done when:**
- Release notes contain source revision, the exact server/web image
  digests, SBOM locations and the steps to verify their attestations.
- A deployment uses approved digests, fails verification for a changed
  image, and can return to the prior pair of digests.
- Signing credentials are not checked into Git or stored in images;
  image builds still run as part of the existing Compose smoke test.

**Validate:** Build a release candidate, verify both image digests and
their SBOM/provenance, reject a deliberately mismatched digest in a
test environment, and run the deployed Chromium/WebSocket smoke check
before and after a rollback.
