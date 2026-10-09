# Record the messages clients send

## What changed

Added short Android and browser message examples and a guide to what each
field means. A server test sends each example through real WebSocket clients
and checks that the other client receives it unchanged. The main README now
shows how to start the built server and explains why opening port 8000 as a web
page says "Upgrade Required."

## Why this helps

The clients use different shapes for offers, answers, and ICE candidates.
These examples make those differences visible before we change either client.
The server tests guard against accidentally breaking an existing message.

## Compatibility

The server's behavior did not change. The guide also calls out an existing
browser bug: it treats an Android `sdp` answer as an offer. A later browser
commit will fix that bug.

## Checks

From `server`, `npm test` passed all 12 tests. This includes the six message
examples and the HTTP "Upgrade Required" response. `npm run typecheck` and
`npm run build` also passed.
