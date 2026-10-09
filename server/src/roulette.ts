import { randomUUID } from 'node:crypto';
import WebSocket, { RawData } from 'ws';

type Session = {
  id: string;
  socket: WebSocket;
  peerId?: string;
};

type RelayMessage = {
  type: 'sdp' | 'answer' | 'ice';
  [key: string]: unknown;
};

type ServerMessage =
  | { type: 'matched'; match: string; offer: boolean }
  | { type: 'peer-left' }
  | { type: 'on-going-call' };

function hasFields(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRelayMessage(value: Record<string, unknown>): value is RelayMessage {
  if (value.type === 'sdp' || value.type === 'answer') {
    return (typeof value.sdp === 'string' && value.sdp.length > 0) ||
      (hasFields(value.data) && typeof value.data.sdp === 'string' && value.data.sdp.length > 0);
  }
  if (value.type === 'ice') {
    return (typeof value.candidate === 'string' && value.candidate.length > 0) ||
      (hasFields(value.data) && typeof value.data.candidate === 'string' && value.data.candidate.length > 0);
  }
  return false;
}

function messageText(data: RawData): string {
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  return Buffer.from(data).toString('utf8');
}

export default class Roulette {
  private readonly sessions = new Map<string, Session>();
  private waitingId?: string;
  private activePair?: [string, string];

  register(socket: WebSocket): void {
    socket.on('error', error => console.error('WebSocket connection failed:', error));

    if (this.activePair) {
      this.send(socket, { type: 'on-going-call' });
      socket.on('message', () => this.reject(socket, 'Call in progress'));
      return;
    }

    const session: Session = { id: randomUUID(), socket };
    this.sessions.set(session.id, session);
    socket.on('close', () => this.unregister(session.id));
    socket.on('error', () => this.unregister(session.id));
    socket.on('message', (data, isBinary) => {
      if (isBinary) {
        this.reject(socket, 'Text messages required');
      } else {
        this.handleMessage(session, messageText(data));
      }
    });

    if (this.waitingId) {
      const other = this.sessions.get(this.waitingId);
      if (!other) throw new Error('Waiting client is missing');

      other.peerId = session.id;
      session.peerId = other.id;
      this.activePair = [other.id, session.id];
      this.waitingId = undefined;
      this.send(socket, { type: 'matched', match: other.id, offer: true });
      this.send(other.socket, { type: 'matched', match: session.id, offer: false });
    } else {
      this.waitingId = session.id;
    }
  }

  private handleMessage(session: Session, raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      this.reject(session.socket, 'Malformed JSON');
      return;
    }

    if (!hasFields(parsed)) {
      this.reject(session.socket, 'Invalid message');
      return;
    }

    if (parsed.type === 'peer-left') {
      this.unregister(session.id);
      session.socket.close(1000, 'Hangup');
      return;
    }

    if (!isRelayMessage(parsed)) {
      this.reject(session.socket, 'Invalid signaling message');
      return;
    }

    const peer = session.peerId && this.sessions.get(session.peerId);
    if (!peer) {
      this.reject(session.socket, 'No active peer');
      return;
    }
    this.send(peer.socket, parsed);
  }

  private unregister(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;

    this.sessions.delete(id);
    if (this.waitingId === id) this.waitingId = undefined;
    if (this.activePair?.includes(id)) this.activePair = undefined;

    const peer = session.peerId ? this.sessions.get(session.peerId) : undefined;
    if (peer?.peerId === id) {
      peer.peerId = undefined;
      if (peer.socket.readyState === WebSocket.OPEN) {
        this.send(peer.socket, { type: 'peer-left' });
      }
    }
  }

  private reject(socket: WebSocket, reason: string): void {
    console.warn(`Rejected signaling message: ${reason}`);
    if (socket.readyState === WebSocket.OPEN) socket.close(1008, reason);
  }

  private send(socket: WebSocket, message: RelayMessage | ServerMessage): void {
    if (socket.readyState !== WebSocket.OPEN) {
      console.error('Could not send signaling message: socket is not open');
      return;
    }
    socket.send(JSON.stringify(message), error => {
      if (error) console.error('Could not send signaling message:', error);
    });
  }
}