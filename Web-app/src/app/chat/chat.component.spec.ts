import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatButtonModule } from '@angular/material/button';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Subject } from 'rxjs';
import { ChatComponent } from './chat.component';
import { DataService } from './service/data.service';
import { Message } from './types/message';
import { createTestMedia, FakePeerConnection, replaceProperty } from '../testing/browser-fakes';

describe('ChatComponent', () => {
  let fixture: ComponentFixture<ChatComponent>;
  let media: ReturnType<typeof createTestMedia>;
  let incoming: Subject<Message>;
  let signaling: {
    connect: jasmine.Spy;
    sendMessage: jasmine.Spy;
    closeWebSocket: jasmine.Spy;
    messages$: Subject<Message>;
  };
  let restoreMediaDevices: () => void;
  let restorePeerConnection: () => void;

  beforeEach(async () => {
    media = createTestMedia();
    incoming = new Subject<Message>();
    signaling = {
      connect: jasmine.createSpy('connect'),
      sendMessage: jasmine.createSpy('sendMessage'),
      closeWebSocket: jasmine.createSpy('closeWebSocket'),
      messages$: incoming
    };
    FakePeerConnection.instances = [];
    restoreMediaDevices = replaceProperty(navigator, 'mediaDevices', {
      getUserMedia: jasmine.createSpy('getUserMedia').and.returnValue(Promise.resolve(media.stream))
    });
    restorePeerConnection = replaceProperty(window, 'RTCPeerConnection', FakePeerConnection);
    await TestBed.configureTestingModule({
      declarations: [ChatComponent],
      imports: [MatButtonModule, NoopAnimationsModule],
      providers: [{ provide: DataService, useValue: signaling }],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();
    fixture = TestBed.createComponent(ChatComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    restorePeerConnection();
    restoreMediaDevices();
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
    expect(buttons.every(button => !button.disabled)).toBeTrue();
  });

  it('sends an offer when Call is clicked', async () => {
    click('Start');
    click('Call');
    await fixture.whenStable();

    expect(signaling.sendMessage).toHaveBeenCalledWith(
      jasmine.objectContaining({ type: 'sdp', sdp: 'v=0\r\n' })
    );
  });

  it('shows a failed offer and closes its connection', async () => {
    spyOn(FakePeerConnection.prototype, 'createOffer').and.returnValue(
      Promise.reject('camera unavailable')
    );
    const alertSpy = spyOn(window, 'alert');

    click('Call');
    await fixture.whenStable();

    expect(alertSpy).toHaveBeenCalledWith('Error opening your camera camera unavailable');
    expect(FakePeerConnection.instances[0].closed).toBe(true);
    expect(signaling.sendMessage).not.toHaveBeenCalled();
  });

  it('sends a hang-up after a call and closes the active connection', async () => {
    click('Call');
    await fixture.whenStable();
    signaling.sendMessage.calls.reset();

    click('Hangup');

    expect(signaling.sendMessage).toHaveBeenCalledWith(
      jasmine.objectContaining({ type: 'peer-left' })
    );
    expect(FakePeerConnection.instances[0].closed).toBe(true);
  });

  it('answers an incoming offer', async () => {
    if (!fixture.ngZone) throw new Error('Angular test zone is unavailable');
    fixture.ngZone.run(() => {
      incoming.next({
        type: 'sdp', data: { type: 'offer', sdp: 'v=0\r\n' },
        sdp: 'v=0\r\n', candidate: '', id: '', label: ''
      });
    });
    await fixture.whenStable();

    expect(signaling.sendMessage).toHaveBeenCalledWith(
      jasmine.objectContaining({ type: 'answer', sdp: 'v=0\r\n' })
    );
  });
});
