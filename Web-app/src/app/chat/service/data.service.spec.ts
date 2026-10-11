import { TestBed } from '@angular/core/testing';
import { FakeWebSocket, replaceProperty } from '../../testing/browser-fakes';
import { IncomingMessage, OutgoingMessage } from '../types/message';
import { DataService, SIGNALING_URL } from './data.service';

describe('DataService', () => {
  let service: DataService;
  let restoreWebSocket: () => void;
  let received: IncomingMessage[];
  let errors: Error[];

  beforeEach(() => {
    FakeWebSocket.instances = [];
    restoreWebSocket = replaceProperty(window, 'WebSocket', FakeWebSocket);
    TestBed.configureTestingModule({
      providers: [{ provide: SIGNALING_URL, useValue: 'ws://example.test:8000/' }]
    });
    service = TestBed.inject(DataService);
    received = [];
    errors = [];
    service.messages$.subscribe(message => received.push(message));
    service.errors$.subscribe(error => errors.push(error));
  });

  afterEach(() => {
    service.closeWebSocket();
    vi.useRealTimers();
    vi.restoreAllMocks();
    restoreWebSocket();
  });

  async function connect(): Promise<FakeWebSocket> {
    service.connect();
    await Promise.resolve();
    return FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
  }

  it('uses the configured address and sends the existing browser wire format', async () => {
    const socket = await connect();
    const offer: OutgoingMessage = {
      type: 'sdp', data: { type: 'offer', sdp: 'v=0\r\n' },
      sdp: 'v=0\r\n', candidate: '', id: '', label: ''
    };
    const ice: OutgoingMessage = {
      type: 'ice', data: { candidate: 'candidate:1', sdpMid: '0', sdpMLineIndex: 0 },
      sdp: '', candidate: '', id: '', label: ''
    };

    service.sendMessage(offer);
    service.sendMessage(ice);

    expect(socket.url).toBe('ws://example.test:8000/');
    expect(socket.sent.map(payload => JSON.parse(payload))).toEqual([offer, ice]);
    expect(errors).toEqual([]);
  });

  it('defaults to the page hostname and signaling port', async () => {
    service.closeWebSocket();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(DataService);

    const socket = await connect();

    expect(socket.url).toBe(`ws://${location.hostname}:8000/`);
  });

  it('rejects a non-WebSocket URL instead of attempting to connect', () => {
    service.closeWebSocket();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: SIGNALING_URL, useValue: 'https://example.test:8000/' }]
    });

    expect(() => TestBed.inject(DataService)).toThrow('Signaling URL must use ws: or wss:');
    expect(FakeWebSocket.instances).toEqual([]);
  });

  it('delivers matched callers and normalizes browser and Android offers and ICE', async () => {
    const socket = await connect();
    socket.receive({ type: 'matched', match: 'peer-1', offer: false });
    socket.receive({ type: 'sdp', data: { type: 'offer', sdp: 'browser-offer' } });
    socket.receive({ type: 'sdp', sdp: 'android-offer' });
    socket.receive({ type: 'ice', data: {
      candidate: 'browser-candidate', sdpMid: '0', sdpMLineIndex: 0
    } });
    socket.receive({ type: 'ice', candidate: 'android-candidate', id: 'audio', label: 1 });

    expect(received).toEqual([
      { type: 'matched', match: 'peer-1', offer: false },
      { type: 'offer', description: { type: 'offer', sdp: 'browser-offer' } },
      { type: 'offer', description: { type: 'offer', sdp: 'android-offer' } },
      { type: 'ice', candidate: {
        candidate: 'browser-candidate', sdpMid: '0', sdpMLineIndex: 0
      } },
      { type: 'ice', candidate: {
        candidate: 'android-candidate', sdpMid: 'audio', sdpMLineIndex: 1
      } }
    ]);
    expect(errors).toEqual([]);
  });

  it('recognizes an Android SDP answer to a local offer and the browser answer format', async () => {
    const socket = await connect();
    socket.receive({ type: 'matched', match: 'peer-1', offer: true });
    service.sendMessage({
      type: 'sdp', data: { type: 'offer', sdp: 'local-offer' },
      sdp: 'local-offer', candidate: '', id: '', label: ''
    });
    socket.receive({ type: 'sdp', sdp: 'android-answer' });
    socket.receive({ type: 'answer', data: { type: 'answer', sdp: 'browser-answer' } });

    expect(received).toEqual([
      { type: 'matched', match: 'peer-1', offer: true },
      { type: 'answer', description: { type: 'answer', sdp: 'android-answer' } },
      { type: 'answer', description: { type: 'answer', sdp: 'browser-answer' } }
    ]);
  });

  it('passes through busy and hang-up notices', async () => {
    const socket = await connect();
    socket.receive({ type: 'on-going-call' });
    socket.receive({ type: 'peer-left' });

    expect(received).toEqual([{ type: 'on-going-call' }, { type: 'peer-left' }]);
    expect(errors).toEqual([]);
  });

  it('reports invalid messages and sends nothing while disconnected', () => {
    service.sendMessage({
      type: 'peer-left', data: '', sdp: '', candidate: '', id: '', label: ''
    });
    expect(errors[0].message).toContain('not open');

    service.connect();
    FakeWebSocket.instances[0].receive({ type: 'ice', label: 'not-an-index' });
    FakeWebSocket.instances[0].receive({ type: 'sdp', sdp: 'unclassified' });
    FakeWebSocket.instances[0].receive({ type: 'unknown' });

    expect(received).toEqual([]);
    expect(errors.map(error => error.message)).toEqual([
      'Signaling connection is not open',
      'Invalid ICE candidate',
      'Cannot identify SDP before matching',
      'Unsupported signaling message: unknown'
    ]);
  });

  it('rejects conflicting browser envelopes instead of guessing the message type', async () => {
    const socket = await connect();
    socket.receive({ type: 'matched', match: 'peer-1', offer: false });
    socket.receive({ type: 'answer', data: { type: 'offer', sdp: 'v=0' } });
    socket.receive({ type: 'sdp', sdp: 'first', data: { type: 'offer', sdp: 'second' } });
    socket.receive({ type: 'ice', candidate: 'legacy', id: 'audio', label: 0, data: {} });

    expect(received).toEqual([{ type: 'matched', match: 'peer-1', offer: false }]);
    expect(errors.map(error => error.message)).toEqual([
      'Invalid SDP type', 'Invalid SDP message', 'Invalid ICE candidate'
    ]);
  });

  it('reports a connection failure and cancels its retry when closed', async () => {
    vi.useFakeTimers();
    const socket = await connect();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    socket.onerror?.(new Event('error'));

    expect(errors[0].message).toBe('Signaling connection failed');
    service.closeWebSocket();
    await vi.advanceTimersByTimeAsync(2000);

    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('connects once and never retries after an intentional close', async () => {
    vi.useFakeTimers();
    const socket = await connect();
    service.connect();
    expect(FakeWebSocket.instances).toHaveLength(1);

    service.closeWebSocket();
    expect(socket.readyState).toBe(FakeWebSocket.CLOSED);
    await vi.advanceTimersByTimeAsync(2000);

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  it('does not leave a live socket behind when closed before it opens', async () => {
    vi.useFakeTimers();
    service.connect();
    const socket = FakeWebSocket.instances[0];
    service.closeWebSocket();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(2000);

    expect(socket.readyState).toBe(FakeWebSocket.CLOSED);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('reports an unexpected close and reconnects without duplicate listeners', async () => {
    vi.useFakeTimers();
    const socket = await connect();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    socket.onclose?.(new CloseEvent('close', { code: 1011, reason: 'server failed' }));

    expect(errors[0].message).toContain('1011: server failed');
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeWebSocket.instances).toHaveLength(2);
    FakeWebSocket.instances[1].receive({ type: 'matched', match: 'peer-2', offer: false });

    expect(received).toEqual([{ type: 'matched', match: 'peer-2', offer: false }]);
    expect(consoleSpy).toHaveBeenCalledOnce();
  });
});
