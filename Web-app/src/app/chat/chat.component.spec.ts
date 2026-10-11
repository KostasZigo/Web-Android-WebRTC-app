import { provideZoneChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Subject } from 'rxjs';
import type { Mock } from 'vitest';
import { AppModule } from '../app.module';
import { ChatComponent } from './chat.component';
import { DataService } from './service/data.service';
import { IncomingMessage, OutgoingMessage } from './types/message';
import { createTestMedia, FakePeerConnection, replaceProperty } from '../testing/browser-fakes';

describe('ChatComponent', () => {
  let fixture: ComponentFixture<ChatComponent>;
  let media: ReturnType<typeof createTestMedia>;
  let incoming: Subject<IncomingMessage>;
  let failures: Subject<Error>;
  let signaling: {
    connect: Mock<() => void>;
    sendMessage: Mock<(message: OutgoingMessage) => void>;
    closeWebSocket: Mock<() => void>;
    messages$: Subject<IncomingMessage>;
    errors$: Subject<Error>;
  };
  let restoreMediaDevices: () => void;
  let restorePeerConnection: () => void;

  beforeEach(async () => {
    media = createTestMedia();
    incoming = new Subject<IncomingMessage>();
    failures = new Subject<Error>();
    signaling = {
      connect: vi.fn(),
      sendMessage: vi.fn(),
      closeWebSocket: vi.fn(),
      messages$: incoming,
      errors$: failures
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
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    restorePeerConnection();
    restoreMediaDevices();
    vi.restoreAllMocks();
  });

  function click(label: string): void {
    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const button = buttons.find(candidate => candidate.textContent?.trim() === label);
    if (!button) throw new Error(`Missing ${label} button`);
    button.click();
    fixture.detectChanges();
  }

  it('starts with media paused and toggles the local preview', () => {
    const preview: HTMLVideoElement = fixture.nativeElement.querySelector('video');
    expect(media.track.enabled).toBe(false);

    click('Start');
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

  it('sends an offer when Call is clicked', async () => {
    click('Start');
    click('Call');
    await fixture.whenStable();

    expect(signaling.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'sdp', sdp: 'v=0\r\n' })
    );
  });

  it('shows a failed offer and closes its connection', async () => {
    vi.spyOn(FakePeerConnection.prototype, 'createOffer').mockRejectedValue('camera unavailable');
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);

    click('Call');
    await fixture.whenStable();

    expect(alertSpy).toHaveBeenCalledWith('Error opening your camera camera unavailable');
    expect(FakePeerConnection.instances[0].closed).toBe(true);
    expect(signaling.sendMessage).not.toHaveBeenCalled();
  });

  it('sends a hang-up after a call and closes the active connection', async () => {
    click('Call');
    await fixture.whenStable();
    signaling.sendMessage.mockClear();

    click('Hangup');

    expect(signaling.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'peer-left' })
    );
    expect(FakePeerConnection.instances[0].closed).toBe(true);
  });

  it('closes the call when the other caller leaves', async () => {
    click('Call');
    await fixture.whenStable();
    const activeCall = FakePeerConnection.instances[0];

    if (!fixture.ngZone) throw new Error('Angular test zone is unavailable');
    fixture.ngZone.run(() => incoming.next({ type: 'peer-left' }));

    expect(activeCall.closed).toBe(true);
    expect(signaling.closeWebSocket).toHaveBeenCalledOnce();
  });

  it('answers an incoming offer', async () => {
    if (!fixture.ngZone) throw new Error('Angular test zone is unavailable');
    fixture.ngZone.run(() => {
      incoming.next({
        type: 'offer', description: { type: 'offer', sdp: 'v=0\r\n' }
      });
    });
    await fixture.whenStable();

    expect(signaling.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'answer', sdp: 'v=0\r\n' })
    );
  });

  it('applies an Android answer to the current call instead of answering it again', async () => {
    const remoteDescription = vi.spyOn(FakePeerConnection.prototype, 'setRemoteDescription');
    click('Call');
    await fixture.whenStable();
    if (!fixture.ngZone) throw new Error('Angular test zone is unavailable');

    fixture.ngZone.run(() => incoming.next({
      type: 'answer', description: { type: 'answer', sdp: 'android-answer' }
    }));
    await fixture.whenStable();

    expect(remoteDescription).toHaveBeenCalledWith({
      type: 'answer', sdp: 'android-answer'
    });
    expect(signaling.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('shows signaling failures once until a new match and reports busy calls', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    if (!fixture.ngZone) throw new Error('Angular test zone is unavailable');
    fixture.ngZone.run(() => {
      failures.next(new Error('Connection lost'));
      failures.next(new Error('Connection lost'));
      incoming.next({ type: 'matched', match: 'peer-1', offer: false });
      failures.next(new Error('Connection lost'));
      incoming.next({ type: 'on-going-call' });
    });

    expect(alertSpy.mock.calls.map(([message]) => message)).toEqual([
      'Connection lost', 'Connection lost', 'A call is already in progress. Try again later.'
    ]);
    expect(signaling.closeWebSocket).toHaveBeenCalledOnce();
  });

  it('stops listening to signaling events when the component is destroyed', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    fixture.destroy();
    failures.next(new Error('Connection lost'));
    incoming.next({ type: 'on-going-call' });

    expect(alertSpy).not.toHaveBeenCalled();
    expect(signaling.closeWebSocket).toHaveBeenCalledOnce();
  });
});
