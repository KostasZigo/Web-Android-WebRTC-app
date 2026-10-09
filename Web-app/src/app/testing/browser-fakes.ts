export function replaceProperty(target: object, name: string, value: unknown): () => void {
  const previous = Object.getOwnPropertyDescriptor(target, name);
  Object.defineProperty(target, name, { configurable: true, value });
  return () => {
    if (previous) {
      Object.defineProperty(target, name, previous);
    } else {
      Reflect.deleteProperty(target, name);
    }
  };
}

export function createTestMedia(): { stream: MediaStream; track: MediaStreamTrack } {
  const stream = new MediaStream();
  const track = { enabled: true } as MediaStreamTrack;
  spyOn(stream, 'getTracks').and.returnValue([track]);
  return { stream, track };
}

export class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readonly sent: string[] = [];
  readyState = FakeWebSocket.CONNECTING;
  binaryType: BinaryType = 'blob';
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
    Promise.resolve().then(() => {
      if (this.readyState === FakeWebSocket.CONNECTING) {
        this.readyState = FakeWebSocket.OPEN;
        this.onopen?.(new Event('open'));
      }
    });
  }

  send(message: string): void {
    this.sent.push(message);
  }

  receive(message: unknown): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(message) }));
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }
}

export class FakePeerConnection {
  static instances: FakePeerConnection[] = [];
  localDescription: RTCSessionDescriptionInit | null = null;
  closed = false;

  constructor() {
    FakePeerConnection.instances.push(this);
  }

  addTrack(): void {}

  createOffer(): Promise<RTCSessionDescriptionInit> {
    return Promise.resolve({ type: 'offer', sdp: 'v=0\r\n' });
  }

  createAnswer(): Promise<RTCSessionDescriptionInit> {
    return Promise.resolve({ type: 'answer', sdp: 'v=0\r\n' });
  }

  setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.localDescription = description;
    return Promise.resolve();
  }

  setRemoteDescription(): Promise<void> {
    return Promise.resolve();
  }

  getTransceivers(): { stop(): void }[] {
    return [];
  }

  close(): void {
    this.closed = true;
  }
}
