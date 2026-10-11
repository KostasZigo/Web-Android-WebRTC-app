# Commit 15: Make Android signaling messages reliable

## What changed

- Moved message reading and writing into one Android signaling codec. It
  handles match and busy notices, hang-ups, offers, answers, and ICE from
  both the browser and Android.
- The codec checks missing, broken, and conflicting fields instead of
  guessing what a message means. Android still sends the same SDP and ICE
  format as before.
- Invalid messages, failed sends, and unexpected socket closures now
  report an error to the call screen. A normal hang-up is not reported as
  a connection failure.
- Added ten JVM tests for the shared browser/Android examples, bad messages,
  outgoing messages, and socket errors. The tests share a fixture reader
  and a wire-message comparison helper.

## Why this helps

The two clients use different message shapes. Keeping their translation
in one place makes calls easier to maintain and stops broken messages from
causing a crash or disappearing without an explanation.

## Compatibility and remaining work

The server protocol and Android call flow have not changed. Android
continues to use the match role to tell whether a top-level `sdp` from
another Android client is an offer or an answer. A real browser-to-phone
call was not tested here. Native call cleanup and failure handling remain
for the next separately approved commit.

## Checks

- `:app:testDebugUnitTest :app:assembleDebug :app:lintDebug` passed:
  **20 JVM tests**, a debug APK, **0 lint errors**, and 12 lint warnings.
- The JVM tests read all six shared protocol examples directly from
  `protocol/fixtures`.
