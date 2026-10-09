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
