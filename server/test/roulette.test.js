const assert = require('node:assert/strict');
const test = require('node:test');
const { connectClient, startServer } = require('./websocket-test-helpers');

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
