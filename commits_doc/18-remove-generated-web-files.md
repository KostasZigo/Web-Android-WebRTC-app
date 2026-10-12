# Commit 18: Stop tracking old web build files

## What changed

- Removed seven old files from `Web-app\dist\webTerra` and the unused
  `Web-app\src\app.zip` archive from Git.
- Kept the existing ignore rules for generated web builds and the archive.
  Updated the web README to show the normal production build command.

## Why this helps

The repository now contains the web app's source, not an older second copy
of its output. Fresh builds make the browser files when they are needed.
This avoids accidentally serving an outdated page or changing generated
files in a future commit.

## Compatibility and remaining work

No call controls, messages, or deployment ports changed. The web image
still builds from source. The Angular build still warns that its initial
bundle is 580.58 kB, above the 500 kB warning limit. A physical phone
call and an HTTPS/WSS deployment were not tested here.

## Checks

- A normal production Angular build recreated `dist\webTerra` from source.
  The new output and the old archive remain ignored by Git.
- All 38 web behavior tests passed (92.54% statements, 82.55% branches).
  Web lint and both browser end-to-end tests passed.
- A clean, uncached web container build succeeded with the old files
  removed. The deployed page, Chromium WebSocket route, and message relay
  passed in the 13-test server suite. Server TypeScript checking passed.
  The test containers were stopped afterward.
