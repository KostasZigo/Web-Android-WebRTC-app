import { inject, Injectable, InjectionToken } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { decodeMessage, IncomingMessage, OutgoingMessage } from '../types/message';

export const SIGNALING_URL = new InjectionToken<string>('SIGNALING_URL', {
  providedIn: 'root',
  factory: () =>
    `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.hostname}:8000/`
});

const reconnectDelayMs = 1000;

@Injectable({ providedIn: 'root' })
export class DataService {
  private readonly url = inject(SIGNALING_URL);
  private readonly messages = new Subject<IncomingMessage>();
  private readonly errors = new Subject<Error>();
  readonly messages$ = this.messages.asObservable();
  readonly errors$ = this.errors.asObservable();

  private socket?: WebSocketSubject<unknown>;
  private socketSubscription?: Subscription;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private intentionallyClosed = false;
  private connected = false;
  private offerer?: boolean;
  private awaitingAnswer = false;

  constructor() {
    const protocol = new URL(this.url).protocol;
    if (protocol !== 'ws:' && protocol !== 'wss:') {
      throw new TypeError('Signaling URL must use ws: or wss:');
    }
  }

  connect(): void {
    this.intentionallyClosed = false;
    if (this.socket) return;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = undefined;
    }

    const socket = webSocket<unknown>({
      url: this.url,
      WebSocketCtor: WebSocket,
      openObserver: { next: () => {
        if (this.socket === socket) this.connected = true;
      } },
      closeObserver: {
        next: event => this.onDisconnected(
          socket,
          new Error(`Signaling connection closed (${event.code}${event.reason ? `: ${event.reason}` : ''})`)
        )
      }
    });
    this.socket = socket;
    const subscription = socket.subscribe({
      next: message => this.onMessage(message),
      error: error => this.onDisconnected(
        socket,
        error instanceof Error ? error : new Error('Signaling connection failed')
      ),
      complete: () => this.onDisconnected(socket)
    });
    if (this.socket === socket) {
      this.socketSubscription = subscription;
    } else {
      subscription.unsubscribe();
    }
  }

  sendMessage(message: OutgoingMessage): void {
    if (!this.socket || !this.connected) {
      this.errors.next(new Error('Signaling connection is not open'));
      return;
    }
    if (((message.type === 'sdp' || message.type === 'answer') &&
        (!message.sdp || message.data.sdp !== message.sdp)) ||
        (message.type === 'ice' && !message.data.candidate)) {
      this.errors.next(new Error('Invalid outgoing signaling message'));
      return;
    }

    this.socket.next(message);
    if (message.type === 'sdp') this.awaitingAnswer = true;
  }

  closeWebSocket(): void {
    this.intentionallyClosed = true;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = undefined;
    }
    this.socket = undefined;
    this.connected = false;
    this.offerer = undefined;
    this.awaitingAnswer = false;
    this.socketSubscription?.unsubscribe();
    this.socketSubscription = undefined;
  }

  private onMessage(raw: unknown): void {
    const message = decodeMessage(raw, this.offerer, this.awaitingAnswer);
    if (message instanceof Error) {
      this.errors.next(message);
      return;
    }
    if (message.type === 'matched') {
      this.offerer = message.offer;
      this.awaitingAnswer = false;
    } else if (message.type === 'answer' || message.type === 'peer-left') {
      this.awaitingAnswer = false;
    }
    this.messages.next(message);
  }

  private onDisconnected(socket: WebSocketSubject<unknown>, error?: Error): void {
    if (this.socket !== socket) return;
    this.socket = undefined;
    this.connected = false;
    this.offerer = undefined;
    this.awaitingAnswer = false;
    this.socketSubscription?.unsubscribe();
    this.socketSubscription = undefined;

    if (this.intentionallyClosed) return;
    if (error) {
      console.error('Signaling connection failed:', error);
      this.errors.next(error);
    }
    if (!this.intentionallyClosed) {
      this.retryTimer = setTimeout(() => {
        this.retryTimer = undefined;
        this.connect();
      }, reconnectDelayMs);
    }
  }
}
