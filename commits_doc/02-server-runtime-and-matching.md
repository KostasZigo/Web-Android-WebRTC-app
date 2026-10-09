# Modern server and reliable matching

## What changed

The server now builds and runs on Node 24. It uses one npm lockfile, current
WebSocket and TypeScript packages, and a container that builds from source.
Connections wait for one partner; only one pair can call at a time. A closed
call makes room for the next pair. Bad messages close that connection instead
of being passed to another person.

## Why this helps

The old server could stay busy after a caller left and could send the same
hang-up notice twice. The new tests cover these cases as real WebSocket
conversations. The server also reports connection and input errors without
printing anyone's call data.

## Compatibility

The message names, fields, offer roles, and one-pair limit stay the same. A
caller that sends `peer-left` is now disconnected after its peer is notified.
Extra callers still receive `on-going-call` and must retry later.

## Run and checks

From `server`, use `npm run dev` while editing, or `npm run build` followed by
`npm start` to run the built server. Set `PORT` if port 8000 is unavailable.

`npm test` passed all 10 WebSocket tests. `npm run typecheck` and
`npm run build` passed. A smoke check connected two real clients to the built
server and confirmed they matched; an invalid `PORT` failed with a clear error.
The Docker image was not run because Docker is not installed in this environment.
