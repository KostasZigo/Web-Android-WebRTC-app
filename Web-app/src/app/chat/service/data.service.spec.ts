import { TestBed } from '@angular/core/testing';
import { DataService } from './data.service';
import { Message } from '../types/message';
import { FakeWebSocket, replaceProperty } from '../../testing/browser-fakes';

describe('DataService', () => {
  let service: DataService;
  let restoreWebSocket: () => void;

  beforeEach(() => {
    FakeWebSocket.instances = [];
    restoreWebSocket = replaceProperty(window, 'WebSocket', FakeWebSocket);
    TestBed.configureTestingModule({});
    service = TestBed.inject(DataService);
  });

  afterEach(() => restoreWebSocket());

  it('sends a call message over the open WebSocket', async () => {
    service.connect();
    await Promise.resolve();
    const message: Message = {
      type: 'peer-left', data: '', sdp: '', candidate: '', id: '', label: ''
    };

    service.sendMessage(message);

    expect(FakeWebSocket.instances.length).toBe(1);
    expect(JSON.parse(FakeWebSocket.instances[0].sent[0])).toEqual(message);
  });

  it('delivers an incoming signaling message to subscribers', async () => {
    const received: Message[] = [];
    service.messages$.subscribe(message => received.push(message));
    service.connect();
    await Promise.resolve();
    const message: Message = {
      type: 'matched', data: '', sdp: '', candidate: '', id: '', label: ''
    };

    FakeWebSocket.instances[0].receive(message);

    expect(received).toEqual([message]);
  });
});
