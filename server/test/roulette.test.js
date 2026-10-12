const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');
const test = require('node:test');
const { connectClient, startServer } = require('./websocket-test-helpers');

function fixture(name) {
  return JSON.parse(readFileSync(path.join(__dirname, '..', '..', 'protocol', 'fixtures', `${name}.json`), 'utf8'));
}

test('explains that an HTTP visit needs a WebSocket upgrade', async t => {
  const url = await startServer(t);
  const response = await fetch(url.replace(/^ws:/, 'http:'));
  assert.equal(response.status, 426);
  assert.match(await response.text(), /Upgrade Required/i);
});

test('matches the first two clients and relays browser and Android signaling', async t => {
  const url = await startServer(t);
  const android = await connectClient(t, url);
  const browser = await connectClient(t, url);

  const [androidMatch, browserMatch] = await Promise.all([
    android.receive(),
    browser.receive()
  ]);
  assert.equal(androidMatch.type, 'matched');
  assert.equal(browserMatch.type, 'matched');
  assert.equal(androidMatch.offer, false);
  assert.equal(browserMatch.offer, true);
  assert.match(androidMatch.match, /^[a-f0-9-]{36}$/i);
  assert.match(browserMatch.match, /^[a-f0-9-]{36}$/i);
  assert.notEqual(androidMatch.match, browserMatch.match);
});

test('relays offers, answers, and ICE without rewriting their envelopes', async t => {
  const url = await startServer(t);
  const android = await connectClient(t, url);
  const browser = await connectClient(t, url);
  await Promise.all([android.receive(), browser.receive()]);

  const offer = { type: 'sdp', sdp: 'browser offer', data: { type: 'offer', sdp: 'browser offer' } };
  browser.send(offer);
  assert.deepEqual(await android.receive(), offer);

  const answer = { type: 'answer', sdp: 'android answer' };
  android.send(answer);
  assert.deepEqual(await browser.receive(), answer);

  const candidate = {
    type: 'ice',
    data: { candidate: 'browser candidate', sdpMid: 'audio', sdpMLineIndex: 0 }
  };
  browser.send(candidate);
  assert.deepEqual(await android.receive(), candidate);
});

test('preserves the Android and browser wire examples in both directions', async t => {
  const url = await startServer(t);
  const android = await connectClient(t, url);
  const browser = await connectClient(t, url);
  await Promise.all([android.receive(), browser.receive()]);

  for (const [sender, receiver, name] of [
    [browser, android, 'browser-offer'],
    [android, browser, 'android-answer'],
    [browser, android, 'browser-ice'],
    [android, browser, 'android-ice'],
    [android, browser, 'android-offer'],
    [browser, android, 'browser-answer']
  ]) {
    const message = fixture(name);
    sender.send(message);
    assert.deepEqual(await receiver.receive(), message, `${name} should be relayed unchanged`);
  }
});

test('rejects a third client while a call is active', async t => {
  const url = await startServer(t);
  const first = await connectClient(t, url);
  const second = await connectClient(t, url);
  await Promise.all([first.receive(), second.receive()]);

  const third = await connectClient(t, url);
  assert.deepEqual(await third.receive(), { type: 'on-going-call' });
});

test('tells the remaining peer when its partner disconnects', async t => {
  const url = await startServer(t);
  const first = await connectClient(t, url);
  const second = await connectClient(t, url);
  await Promise.all([first.receive(), second.receive()]);

  await first.close();
  assert.deepEqual(await second.receive(), { type: 'peer-left' });
});

test('makes a new match after the offering peer disconnects', async t => {
  const url = await startServer(t);
  const first = await connectClient(t, url);
  const second = await connectClient(t, url);
  await Promise.all([first.receive(), second.receive()]);

  await second.close();
  assert.deepEqual(await first.receive(), { type: 'peer-left' });

  const third = await connectClient(t, url);
  const fourth = await connectClient(t, url);
  const [thirdMatch, fourthMatch] = await Promise.all([third.receive(), fourth.receive()]);
  assert.equal(thirdMatch.type, 'matched');
  assert.equal(fourthMatch.type, 'matched');
});

test('matches a new visitor after a waiting client disconnects', async t => {
  const url = await startServer(t);
  const departed = await connectClient(t, url);
  await departed.close();

  const first = await connectClient(t, url);
  const second = await connectClient(t, url);
  assert.equal((await first.receive()).type, 'matched');
  assert.equal((await second.receive()).type, 'matched');
});

test('forwards a hang-up once and frees the call slot', async t => {
  const url = await startServer(t);
  const first = await connectClient(t, url);
  const second = await connectClient(t, url);
  await Promise.all([first.receive(), second.receive()]);

  first.send({ type: 'peer-left' });
  assert.deepEqual(await second.receive(), { type: 'peer-left' });
  assert.equal(await first.closed(), 1000);
  await assert.rejects(second.receive(250), /Timed out waiting/);

  const third = await connectClient(t, url);
  const fourth = await connectClient(t, url);
  assert.equal((await third.receive()).type, 'matched');
  assert.equal((await fourth.receive()).type, 'matched');
});

test('rejects malformed signaling without forwarding it', async t => {
  const url = await startServer(t);
  const first = await connectClient(t, url);
  const second = await connectClient(t, url);
  await Promise.all([first.receive(), second.receive()]);

  first.sendRaw('{bad json');
  assert.equal(await first.closed(), 1008);
  assert.deepEqual(await second.receive(), { type: 'peer-left' });
});

test('rejects unsupported messages and missing offer data', async t => {
  const url = await startServer(t);
  const first = await connectClient(t, url);
  const second = await connectClient(t, url);
  await Promise.all([first.receive(), second.receive()]);

  first.send({ type: 'sdp', sdp: '' });
  assert.equal(await first.closed(), 1008);
  assert.deepEqual(await second.receive(), { type: 'peer-left' });

  second.send({ type: 'matched', offer: true });
  assert.equal(await second.closed(), 1008);
});

test('rejects binary messages while keeping the server available', async t => {
  const url = await startServer(t);
  const first = await connectClient(t, url);
  const second = await connectClient(t, url);
  await Promise.all([first.receive(), second.receive()]);

  second.sendRaw(Buffer.from('not a text signal'));
  assert.equal(await second.closed(), 1008);
  assert.deepEqual(await first.receive(), { type: 'peer-left' });

  const third = await connectClient(t, url);
  const fourth = await connectClient(t, url);
  assert.equal((await third.receive()).type, 'matched');
  assert.equal((await fourth.receive()).type, 'matched');
});

test('built deployment serves the browser and relays WebSockets on its own origin',
  { skip: !process.env.DEPLOYMENT_URL }, async t => {
    const origin = new URL(process.env.DEPLOYMENT_URL);
    assert.match(origin.protocol, /^https?:$/);
    const page = await fetch(origin);
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /<app-root>/);
    const script = html.match(/<script[^>]*src="([^"]*main[^"]*\.js)"/);
    assert.ok(script, 'the built browser entry point must be served');
    const bundle = await fetch(new URL(script[1], origin));
    assert.equal(bundle.status, 200);
    assert.match(await bundle.text(), /\/signaling\//);

    const signaling = new URL('/signaling/', origin);
    signaling.protocol = origin.protocol === 'https:' ? 'wss:' : 'ws:';
    const first = await connectClient(t, signaling.href);
    const second = await connectClient(t, signaling.href);
    const [waiting, offering] = await Promise.all([first.receive(), second.receive()]);
    assert.equal(waiting.offer, false);
    assert.equal(offering.offer, true);
    assert.equal(waiting.type, 'matched');
    assert.equal(offering.type, 'matched');

    second.send(fixture('browser-offer'));
    assert.deepEqual(await first.receive(), fixture('browser-offer'));
    first.send(fixture('android-answer'));
    assert.deepEqual(await second.receive(), fixture('android-answer'));
    await first.close();
    await second.close();

    const { chromium } = createRequire(path.join(__dirname, '..', '..', 'Web-app', 'package.json'))('playwright');
    const browser = await chromium.launch({
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
    });
    t.after(() => browser.close());
    const pageInBrowser = await browser.newPage({ permissions: ['camera', 'microphone'] });
    const opened = pageInBrowser.waitForEvent('websocket');
    await pageInBrowser.goto(origin.href);
    assert.equal((await opened).url(), signaling.href);
  });
