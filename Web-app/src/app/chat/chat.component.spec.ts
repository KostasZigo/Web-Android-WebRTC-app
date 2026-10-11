import { provideZoneChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Subject } from 'rxjs';
import type { Mock } from 'vitest';
import { AppModule } from '../app.module';
import { createTestMedia, FakePeerConnection, replaceProperty } from '../testing/browser-fakes';
import { ChatComponent } from './chat.component';
import { DataService } from './service/data.service';
import { IncomingMessage, OutgoingMessage } from './types/message';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

describe('ChatComponent', () => {
  let fixture: ComponentFixture<ChatComponent>;
  let media: ReturnType<typeof createTestMedia>;
  let incoming: Subject<IncomingMessage>;
  let failures: Subject<Error>;
  let disconnected: Subject<void>;
  let signaling: {
    connect: Mock<() => void>;
    sendMessage: Mock<(message: OutgoingMessage) => void>;
    closeWebSocket: Mock<() => void>;
    messages$: Subject<IncomingMessage>;
    errors$: Subject<Error>;
    disconnected$: Subject<void>;
  };
  let restoreMediaDevices: () => void;
  let restorePeerConnection: () => void;

  beforeEach(async () => {
    media = createTestMedia();
    incoming = new Subject<IncomingMessage>();
    failures = new Subject<Error>();
    disconnected = new Subject<void>();
    signaling = {
      connect: vi.fn(),
      sendMessage: vi.fn(),
      closeWebSocket: vi.fn(),
      messages$: incoming,
      errors$: failures,
      disconnected$: disconnected
    };
    FakePeerConnection.instances = [];
    restoreMediaDevices = replaceProperty(navigator, 'mediaDevices', {
      getUserMedia: vi.fn().mockResolvedValue(media.stream)
    });
    restorePeerConnection = replaceProperty(window, 'RTCPeerConnection', FakePeerConnection);
    await TestBed.configureTestingModule({
      imports: [AppModule, NoopAnimationsModule],
      providers: [provideZoneChangeDetection(), { provide: DataService, useValue: signaling }]
    }).compileComponents();
    fixture = TestBed.createComponent(ChatComponent);
    fixture.detectChanges();
    await settle();
  });

  afterEach(() => {
    fixture.destroy();
    restorePeerConnection();
    restoreMediaDevices();
    vi.restoreAllMocks();
  });

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function click(label: string): void {
    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const button = buttons.find(candidate => candidate.textContent?.trim() === label);
    if (!button) throw new Error(`Missing ${label} button`);
    button.click();
    fixture.detectChanges();
  }

  function receive(message: IncomingMessage): void {
    if (!fixture.ngZone) throw new Error('Angular test zone is unavailable');
    fixture.ngZone.run(() => incoming.next(message));
    fixture.detectChanges();
  }

  function match(offer = true): void {
    receive({ type: 'matched', match: 'peer-1', offer });
  }

  function errorText(): string | null {
    return fixture.nativeElement.querySelector('[role="alert"]')?.textContent?.trim() ?? null;
  }

  it('starts with media paused and toggles the local preview', async () => {
    const preview: HTMLVideoElement = fixture.nativeElement.querySelector('video');
    expect(media.track.enabled).toBe(false);

    click('Start');
    await settle();
    expect(media.track.enabled).toBe(true);
    expect(preview.srcObject).toBe(media.stream);

    click('Stop');
    expect(media.track.enabled).toBe(false);
    expect(preview.srcObject).toBeNull();
  });

  it('keeps the four call controls available', () => {
    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    expect(buttons.map(button => button.textContent?.trim())).toEqual([
      'Start', 'Stop', 'Call', 'Hangup'
    ]);
    expect(buttons.every(button => !button.disabled)).toBe(true);
  });

  it('waits for a match before placing a call', async () => {
    click('Call');
    await settle();

    expect(errorText()).toBe('Waiting for another caller.');
    expect(FakePeerConnection.instances).toHaveLength(0);
    expect(signaling.sendMessage).not.toHaveBeenCalled();
  });

  it('waits for the other caller to offer when matched as the answerer', async () => {
    match(false);
    click('Call');
    await settle();

    expect(errorText()).toBe('Waiting for the other caller to start the call.');
    expect(FakePeerConnection.instances).toHaveLength(0);
    receive({ type: 'offer', description: { type: 'offer', sdp: 'android-offer' } });
    await settle();
    expect(signaling.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'answer' })
    );
  });
  it('sends one offer for a matched caller even after repeated Call clicks', async () => {
    match();
    click('Call');
    click('Call');
    await settle();

    expect(FakePeerConnection.instances).toHaveLength(1);
    expect(FakePeerConnection.instances[0].addedTracks).toEqual([
      { track: media.track, stream: media.stream }
    ]);
    expect(signaling.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'sdp', sdp: 'v=0\r\n' })
    );
    expect(signaling.sendMessage).toHaveBeenCalledTimes(1);
    expect(errorText()).toBe('A call is already starting or in progress.');
  });

  it('shows a failed offer and releases the camera and peer', async () => {
    match();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(FakePeerConnection.prototype, 'createOffer').mockRejectedValue('camera unavailable');

    click('Call');
    await settle();

    expect(errorText()).toBe('Unable to start or continue the call: camera unavailable');
    expect(FakePeerConnection.instances[0].closed).toBe(true);
    expect(media.track.stop).toHaveBeenCalledOnce();
    expect(signaling.sendMessage).not.toHaveBeenCalled();
  });

  it('hangs up, clears both videos, and can start a new call with new media', async () => {
    const nextMedia = createTestMedia();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValueOnce(nextMedia.stream);
    const localVideo: HTMLVideoElement = fixture.nativeElement.querySelectorAll('video')[0];
    const remoteVideo: HTMLVideoElement = fixture.nativeElement.querySelectorAll('video')[1];
    match();
    click('Call');
    await settle();
    const previousPeer = FakePeerConnection.instances[0];
    previousPeer.ontrack?.({ streams: [media.stream], track: media.track });
    expect(remoteVideo.srcObject).toBe(media.stream);

    click('Hangup');
    expect(signaling.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'peer-left' })
    );
    expect(previousPeer.closed).toBe(true);
    expect(media.track.stop).toHaveBeenCalledOnce();
    expect(localVideo.srcObject).toBeNull();
    expect(remoteVideo.srcObject).toBeNull();

    match();
    click('Call');
    await settle();
    expect(FakePeerConnection.instances).toHaveLength(2);
    expect(nextMedia.track.stop).not.toHaveBeenCalled();
    expect(signaling.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'sdp', sdp: 'v=0\r\n' })
    );
  });

  it('cleans up and reconnects when the other caller leaves', async () => {
    match();
    click('Call');
    await settle();
    const previousPeer = FakePeerConnection.instances[0];

    receive({ type: 'peer-left' });

    expect(previousPeer.closed).toBe(true);
    expect(media.track.stop).toHaveBeenCalledOnce();
    expect(signaling.closeWebSocket).toHaveBeenCalledOnce();
    expect(signaling.connect).toHaveBeenCalledTimes(2);
    click('Call');
    await settle();
    expect(errorText()).toBe('Waiting for another caller.');
  });

  it('answers an incoming offer and applies ICE received before it', async () => {
    const candidate = { candidate: 'candidate:1', sdpMid: 'audio', sdpMLineIndex: 0 };
    match(false);
    receive({ type: 'ice', candidate });
    receive({ type: 'offer', description: { type: 'offer', sdp: 'remote-offer' } });
    await settle();

    const peer = FakePeerConnection.instances[0];
    expect(peer.remoteDescription).toEqual({ type: 'offer', sdp: 'remote-offer' });
    expect(peer.addedTracks).toEqual([{ track: media.track, stream: media.stream }]);
    expect(peer.receivedCandidates).toEqual([candidate]);
    expect(signaling.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'answer', sdp: 'v=0\r\n' })
    );
  });

  it('replaces an old peer when a new offer arrives without duplicating local media', async () => {
    match(false);
    receive({ type: 'offer', description: { type: 'offer', sdp: 'first-offer' } });
    await settle();
    const firstPeer = FakePeerConnection.instances[0];
    receive({ type: 'offer', description: { type: 'offer', sdp: 'second-offer' } });
    await settle();

    expect(firstPeer.closed).toBe(true);
    expect(FakePeerConnection.instances[1].remoteDescription).toEqual({
      type: 'offer', sdp: 'second-offer'
    });
    expect(media.track.stop).not.toHaveBeenCalled();
    expect(signaling.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('reports a rejected remote offer and notifies the other caller', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(FakePeerConnection.prototype, 'setRemoteDescription')
      .mockRejectedValue(new Error('invalid SDP'));
    match(false);
    receive({ type: 'offer', description: { type: 'offer', sdp: 'bad-offer' } });
    await settle();

    expect(errorText()).toContain('invalid SDP');
    expect(media.track.stop).toHaveBeenCalledOnce();
    expect(FakePeerConnection.instances[0].closed).toBe(true);
    expect(signaling.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'peer-left' })
    );
  });

  it('applies an answer and buffered ICE to the active call', async () => {
    match();
    click('Call');
    await settle();
    const candidate = { candidate: 'candidate:1', sdpMid: 'audio', sdpMLineIndex: 0 };
    receive({ type: 'ice', candidate });
    receive({ type: 'answer', description: { type: 'answer', sdp: 'android-answer' } });
    await settle();

    const peer = FakePeerConnection.instances[0];
    expect(peer.remoteDescription).toEqual({ type: 'answer', sdp: 'android-answer' });
    expect(peer.receivedCandidates).toEqual([candidate]);
    const nextCandidate = { candidate: 'candidate:2', sdpMid: 'audio', sdpMLineIndex: 1 };
    receive({ type: 'ice', candidate: nextCandidate });
    await settle();
    expect(peer.receivedCandidates).toEqual([candidate, nextCandidate]);
    expect(signaling.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('waits for the local offer before applying an early answer', async () => {
    const pendingOffer = deferred<RTCSessionDescriptionInit>();
    vi.spyOn(FakePeerConnection.prototype, 'createOffer').mockReturnValue(pendingOffer.promise);
    match();
    click('Call');
    await Promise.resolve();
    await Promise.resolve();
    expect(FakePeerConnection.instances).toHaveLength(1);

    click('Call');
    receive({ type: 'answer', description: { type: 'answer', sdp: 'early-answer' } });
    pendingOffer.resolve({ type: 'offer', sdp: 'late-offer' });
    await settle();

    expect(errorText()).toBeNull();
    expect(signaling.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'sdp', sdp: 'late-offer' })
    );
    expect(FakePeerConnection.instances[0].remoteDescription).toEqual({
      type: 'answer', sdp: 'early-answer'
    });
  });

  it('ignores an offer that finishes after Hangup', async () => {
    const pendingOffer = deferred<RTCSessionDescriptionInit>();
    vi.spyOn(FakePeerConnection.prototype, 'createOffer').mockReturnValue(pendingOffer.promise);
    match();
    click('Call');
    await Promise.resolve();
    await Promise.resolve();
    click('Hangup');
    pendingOffer.resolve({ type: 'offer', sdp: 'too-late' });
    await settle();

    expect(FakePeerConnection.instances[0].closed).toBe(true);
    expect(media.track.stop).toHaveBeenCalledOnce();
    expect(signaling.sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'sdp' })
    );
  });

  it('stops media that arrives after Hangup without starting a new peer', async () => {
    fixture.destroy();
    const pendingMedia = deferred<MediaStream>();
    const lateMedia = createTestMedia();
    restoreMediaDevices();
    restoreMediaDevices = replaceProperty(navigator, 'mediaDevices', {
      getUserMedia: vi.fn().mockReturnValue(pendingMedia.promise)
    });
    fixture = TestBed.createComponent(ChatComponent);
    fixture.detectChanges();
    match();
    click('Call');
    click('Hangup');
    pendingMedia.resolve(lateMedia.stream);
    await settle();

    expect(lateMedia.track.stop).toHaveBeenCalledOnce();
    expect(FakePeerConnection.instances).toHaveLength(0);
    expect(signaling.sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'sdp' })
    );
  });

  it('reports denied media access and allows a later Start retry', async () => {
    fixture.destroy();
    const permissionError = new Error('blocked');
    permissionError.name = 'NotAllowedError';
    const nextMedia = createTestMedia();
    restoreMediaDevices();
    restoreMediaDevices = replaceProperty(navigator, 'mediaDevices', {
      getUserMedia: vi.fn().mockRejectedValueOnce(permissionError).mockResolvedValue(nextMedia.stream)
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fixture = TestBed.createComponent(ChatComponent);
    fixture.detectChanges();
    await settle();
    expect(errorText()).toContain('Check browser permissions');

    click('Start');
    await settle();
    expect(errorText()).toBeNull();
    expect(nextMedia.track.enabled).toBe(true);
  });

  it('shows actionable permission errors if access is denied during a call', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    click('Hangup');
    const permissionError = new Error('blocked');
    permissionError.name = 'NotAllowedError';
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(permissionError);
    match();
    click('Call');
    await settle();

    expect(errorText()).toContain('Check browser permissions');
    expect(FakePeerConnection.instances).toHaveLength(0);
    expect(signaling.sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'sdp' })
    );
  });

  it('stops a media stream returned after the component was destroyed', async () => {
    fixture.destroy();
    const pendingMedia = deferred<MediaStream>();
    const lateMedia = createTestMedia();
    restoreMediaDevices();
    restoreMediaDevices = replaceProperty(navigator, 'mediaDevices', {
      getUserMedia: vi.fn().mockReturnValue(pendingMedia.promise)
    });
    fixture = TestBed.createComponent(ChatComponent);
    fixture.detectChanges();
    fixture.destroy();

    pendingMedia.resolve(lateMedia.stream);
    await Promise.resolve();
    await Promise.resolve();

    expect(lateMedia.track.stop).toHaveBeenCalledOnce();
    expect(signaling.closeWebSocket).toHaveBeenCalledTimes(2);
  });

  it('ends an active call when signaling disconnects', async () => {
    match();
    click('Call');
    await settle();
    disconnected.next();

    expect(FakePeerConnection.instances[0].closed).toBe(true);
    expect(media.track.stop).toHaveBeenCalledOnce();
    click('Call');
    await settle();
    expect(errorText()).toBe('Waiting for another caller.');
  });

  it('releases the call after an ICE connection failure', async () => {
    match();
    click('Call');
    await settle();
    const peer = FakePeerConnection.instances[0];
    peer.iceConnectionState = 'failed';
    peer.oniceconnectionstatechange?.();
    fixture.detectChanges();

    expect(errorText()).toContain('Call connection failed');
    expect(peer.closed).toBe(true);
    expect(media.track.stop).toHaveBeenCalledOnce();
    expect(signaling.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'peer-left' })
    );
  });

  it('reports a rejected ICE candidate without losing the active call', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    match();
    click('Call');
    await settle();
    receive({ type: 'answer', description: { type: 'answer', sdp: 'remote-answer' } });
    await settle();
    const peer = FakePeerConnection.instances[0];
    vi.spyOn(peer, 'addIceCandidate').mockRejectedValue(new Error('invalid candidate'));
    receive({ type: 'ice', candidate: {
      candidate: 'candidate:1', sdpMid: 'audio', sdpMLineIndex: 0
    } });
    await settle();

    expect(errorText()).toContain('invalid candidate');
    expect(peer.closed).toBe(false);
    expect(media.track.stop).not.toHaveBeenCalled();
  });

  it('shows signaling failures and busy calls without blocking alerts', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    failures.next(new Error('Connection lost'));
    fixture.detectChanges();
    expect(errorText()).toBe('Connection lost');
    match();
    expect(errorText()).toBeNull();
    receive({ type: 'on-going-call' });

    expect(errorText()).toContain('A call is already in progress');
    expect(signaling.closeWebSocket).toHaveBeenCalledOnce();
    expect(alertSpy).not.toHaveBeenCalled();
    expect(media.track.stop).toHaveBeenCalledOnce();
  });

  it('stops listening to signaling events and releases media on destruction', async () => {
    match();
    click('Call');
    await settle();
    const peer = FakePeerConnection.instances[0];
    fixture.destroy();
    failures.next(new Error('Connection lost'));
    incoming.next({ type: 'on-going-call' });

    expect(signaling.closeWebSocket).toHaveBeenCalledOnce();
    expect(media.track.stop).toHaveBeenCalledOnce();
    expect(peer.closed).toBe(true);
    expect(fixture.componentInstance.errorMessage).toBeNull();
  });
});
