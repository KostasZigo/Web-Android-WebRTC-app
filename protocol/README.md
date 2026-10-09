# Signaling messages (documented v1)

The `v1` label identifies this guide; the existing messages have no version
field on the wire.

The server accepts WebSocket connections at `/` (port 8000 by default). It
matches the first two clients. The first receives
`{"type":"matched","match":"<other ID>","offer":false}`; the second receives
the same message with its partner's ID and `"offer":true`. A third connection
receives `{"type":"on-going-call"}` while the pair is active. Busy clients
must disconnect and retry later; they are not queued for another match.

Peers send `sdp`, `answer`, `ice`, or `peer-left` messages. The server checks
that an SDP or ICE payload is present, then forwards valid messages without
rewriting their fields. It does not decide whether an SDP is an offer or an
answer. A `peer-left` message closes its sender with code 1000 and notifies
the other peer once. Socket disconnects also notify the remaining peer.
Malformed, unsupported, or binary messages close the sender with code 1008.

The examples in `fixtures\` use short stand-in SDP and ICE values, not a full
call's media descriptions:

| Sender | SDP / answer | ICE |
| --- | --- | --- |
| Android | `type: "sdp"` with top-level `sdp` for both offers **and answers** | Top-level `candidate`, `id` (media ID), and numeric `label` (media-line index) |
| Browser | `type: "sdp"` for offers or `type: "answer"` for answers, with `data: {type, sdp}` and top-level `sdp` | `data: {candidate, sdpMid, sdpMLineIndex}`; current browser code also sends empty legacy fields |

Android currently distinguishes an incoming `sdp` offer from an answer using
its match role. The browser currently treats **every** incoming `sdp` as an
offer, so an Android answer sent as `sdp` is not yet handled correctly by the
browser. This is a known client-side bug, not a server translation feature;
the planned browser signaling refactor will fix it. The server tests assert
the existing wire shapes remain unchanged while clients are upgraded.
