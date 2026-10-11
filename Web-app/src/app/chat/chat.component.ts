import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild
} from '@angular/core';
import { Subscription } from 'rxjs';
import { DataService } from './service/data.service';
import { IceCandidate, SessionDescription } from './types/message';

const mediaConstraints: MediaStreamConstraints = {
  audio: true,
  video: { width: 720, height: 540 }
};

const offerOptions: RTCOfferOptions = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: true
};

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class ChatComponent implements AfterViewInit, OnDestroy {
  @ViewChild('local_video') localVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('received_video') remoteVideo!: ElementRef<HTMLVideoElement>;
  errorMessage: string | null = null;

  private readonly signalingSubscriptions = new Subscription();
  private localStream?: MediaStream;
  private mediaRequest?: Promise<MediaStream>;
  private mediaEpoch = 0;
  private peerConnection?: RTCPeerConnection;
  private callEpoch = 0;
  private callStarting = false;
  private pendingAnswer?: SessionDescription;
  private readonly pendingCandidates: IceCandidate[] = [];
  private offerer?: boolean;
  private destroyed = false;

  constructor(private dataService: DataService) {}

  ngAfterViewInit(): void {
    this.addIncomingMessageHandling();
    const epoch = this.mediaEpoch;
    void this.getLocalStream().then(
      stream => {
        if (!this.destroyed && this.mediaEpoch === epoch && this.localStream === stream) {
          this.pauseLocalVideo();
        }
      },
      error => {
        if (!this.destroyed && this.mediaEpoch === epoch) this.showMediaError(error);
      }
    );
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.signalingSubscriptions.unsubscribe();
    this.endCall();
    this.dataService.closeWebSocket();
  }

  async startLocalVideo(): Promise<void> {
    const epoch = this.mediaEpoch;
    try {
      const stream = await this.getLocalStream();
      if (this.destroyed || this.mediaEpoch !== epoch) return;
      stream.getTracks().forEach(track => { track.enabled = true; });
      this.localVideo.nativeElement.srcObject = stream;
      this.errorMessage = null;
    } catch (error) {
      if (!this.destroyed && this.mediaEpoch === epoch) this.showMediaError(error);
    }
  }

  pauseLocalVideo(): void {
    this.localStream?.getTracks().forEach(track => { track.enabled = false; });
    this.localVideo.nativeElement.srcObject = null;
  }

  async call(): Promise<void> {
    if (this.offerer === undefined) {
      this.showError('Waiting for another caller.');
      return;
    }
    if (!this.offerer) {
      this.showError('Waiting for the other caller to start the call.');
      return;
    }
    if (this.callStarting || this.peerConnection) {
      this.showError('A call is already starting or in progress.');
      return;
    }

    const epoch = ++this.callEpoch;
    this.callStarting = true;
    this.pendingCandidates.length = 0;
    this.pendingAnswer = undefined;
    try {
      const stream = await this.getLocalStream();
      if (!this.isCurrent(epoch)) return;
      const peer = this.createPeerConnection();
      this.attachLocalTracks(peer, stream);
      const offer = await peer.createOffer(offerOptions);
      if (!this.isActivePeer(peer, epoch)) return;
      if (offer.type !== 'offer' || !offer.sdp) throw new Error('Invalid offer');
      await peer.setLocalDescription(offer);
      if (!this.isActivePeer(peer, epoch)) return;
      this.errorMessage = null;
      this.dataService.sendMessage({
        type: 'sdp',
        data: { type: 'offer', sdp: offer.sdp },
        sdp: offer.sdp,
        candidate: '',
        id: '',
        label: ''
      });
      if (this.pendingAnswer) {
        const answer = this.pendingAnswer;
        this.pendingAnswer = undefined;
        await this.applyRemoteDescription(peer, answer, epoch);
      }
    } catch (error) {
      if (this.isCurrent(epoch)) {
        this.showCallError(error);
        this.endCall();
      }
    } finally {
      if (this.isCurrent(epoch)) this.callStarting = false;
    }
  }

  hangUp(): void {
    if (this.offerer !== undefined) {
      this.dataService.sendMessage({
        type: 'peer-left',
        data: '',
        sdp: '',
        candidate: '',
        id: '',
        label: ''
      });
    }
    this.offerer = undefined;
    this.endCall();
  }

  private async getLocalStream(): Promise<MediaStream> {
    if (this.localStream) return this.localStream;
    if (!this.mediaRequest) {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera and microphone are not available in this browser');
      }
      const epoch = this.mediaEpoch;
      const request = navigator.mediaDevices.getUserMedia(mediaConstraints).then(stream => {
        if (this.destroyed || this.mediaEpoch !== epoch) {
          stream.getTracks().forEach(track => track.stop());
        } else {
          this.localStream = stream;
        }
        return stream;
      }).finally(() => {
        if (this.mediaRequest === request) this.mediaRequest = undefined;
      });
      this.mediaRequest = request;
    }
    return this.mediaRequest;
  }

  private releaseMedia(): void {
    this.mediaEpoch++;
    this.mediaRequest = undefined;
    this.localStream?.getTracks().forEach(track => track.stop());
    this.localStream = undefined;
    this.localVideo.nativeElement.srcObject = null;
  }

  private createPeerConnection(): RTCPeerConnection {
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: ['stun:stun.kundenserver.de:3478'] }]
    });
    this.peerConnection = peer;
    peer.onicecandidate = event => {
      if (this.peerConnection === peer && !this.destroyed && event.candidate?.candidate) {
        this.dataService.sendMessage({
          type: 'ice',
          data: event.candidate,
          sdp: '',
          candidate: '',
          id: '',
          label: ''
        });
      }
    };
    peer.oniceconnectionstatechange = () => {
      if (this.peerConnection === peer && peer.iceConnectionState === 'failed') {
        this.showError('Call connection failed. Try calling again.');
        this.hangUp();
      }
    };
    peer.onsignalingstatechange = () => {
      if (this.peerConnection === peer && peer.signalingState === 'closed') {
        this.showError('Call connection closed. Try calling again.');
        this.hangUp();
      }
    };
    peer.ontrack = event => {
      if (this.peerConnection === peer && !this.destroyed) {
        this.remoteVideo.nativeElement.srcObject =
          event.streams[0] ?? new MediaStream([event.track]);
      }
    };
    return peer;
  }

  private attachLocalTracks(peer: RTCPeerConnection, stream: MediaStream): void {
    this.localVideo.nativeElement.srcObject = stream;
    stream.getTracks().forEach(track => peer.addTrack(track, stream));
  }

  private closePeer(): void {
    const peer = this.peerConnection;
    this.peerConnection = undefined;
    this.remoteVideo.nativeElement.srcObject = null;
    if (!peer) return;
    peer.onicecandidate = null;
    peer.oniceconnectionstatechange = null;
    peer.onsignalingstatechange = null;
    peer.ontrack = null;
    peer.close();
  }

  private endCall(): void {
    this.callEpoch++;
    this.callStarting = false;
    this.pendingAnswer = undefined;
    this.pendingCandidates.length = 0;
    this.closePeer();
    this.releaseMedia();
  }

  private isCurrent(epoch: number): boolean {
    return !this.destroyed && this.callEpoch === epoch;
  }

  private isActivePeer(peer: RTCPeerConnection, epoch: number): boolean {
    return this.isCurrent(epoch) && this.peerConnection === peer;
  }

  private addIncomingMessageHandling(): void {
    this.signalingSubscriptions.add(this.dataService.messages$.subscribe(message => {
      switch (message.type) {
        case 'offer':
          void this.handleOfferMessage(message.description);
          break;
        case 'answer':
          void this.handleAnswerMessage(message.description);
          break;
        case 'ice':
          this.handleICECandidateMessage(message.candidate);
          break;
        case 'peer-left':
          this.offerer = undefined;
          this.endCall();
          this.dataService.closeWebSocket();
          this.dataService.connect();
          break;
        case 'matched':
          this.offerer = message.offer;
          this.errorMessage = null;
          break;
        case 'on-going-call':
          this.offerer = undefined;
          this.showError('A call is already in progress. Try again later.');
          this.endCall();
          this.dataService.closeWebSocket();
          break;
      }
    }));
    this.signalingSubscriptions.add(this.dataService.disconnected$.subscribe(() => {
      this.offerer = undefined;
      this.endCall();
    }));
    this.signalingSubscriptions.add(this.dataService.errors$.subscribe(error => {
      this.showError(error.message, error);
    }));
    this.dataService.connect();
  }

  private async handleOfferMessage(description: SessionDescription): Promise<void> {
    const epoch = ++this.callEpoch;
    this.callStarting = true;
    this.pendingAnswer = undefined;
    this.closePeer();
    try {
      const stream = await this.getLocalStream();
      if (!this.isCurrent(epoch)) return;
      const peer = this.createPeerConnection();
      await this.applyRemoteDescription(peer, description, epoch);
      if (!this.isActivePeer(peer, epoch)) return;
      this.attachLocalTracks(peer, stream);
      const answer = await peer.createAnswer();
      if (!this.isActivePeer(peer, epoch)) return;
      if (answer.type !== 'answer' || !answer.sdp) throw new Error('Invalid answer');
      await peer.setLocalDescription(answer);
      if (!this.isActivePeer(peer, epoch)) return;
      this.errorMessage = null;
      this.dataService.sendMessage({
        type: 'answer',
        data: { type: 'answer', sdp: answer.sdp },
        sdp: answer.sdp,
        candidate: '',
        id: '',
        label: ''
      });
    } catch (error) {
      if (this.isCurrent(epoch)) {
        this.showCallError(error);
        this.hangUp();
      }
    } finally {
      if (this.isCurrent(epoch)) this.callStarting = false;
    }
  }

  private async handleAnswerMessage(description: SessionDescription): Promise<void> {
    const peer = this.peerConnection;
    if (this.callStarting && (!peer || peer.localDescription?.type !== 'offer')) {
      this.pendingAnswer = description;
      return;
    }
    if (!peer) {
      this.showError('Received an answer before starting a call.');
      return;
    }
    try {
      await this.applyRemoteDescription(peer, description, this.callEpoch);
    } catch (error) {
      if (this.peerConnection === peer) {
        this.showCallError(error);
        this.hangUp();
      }
    }
  }

  private handleICECandidateMessage(candidate: IceCandidate): void {
    const peer = this.peerConnection;
    if (!peer || !peer.remoteDescription) {
      this.pendingCandidates.push(candidate);
      return;
    }
    void peer.addIceCandidate(candidate).catch(error => {
      if (this.peerConnection === peer && !this.destroyed) {
        this.showCallError(error);
      }
    });
  }

  private async applyRemoteDescription(
    peer: RTCPeerConnection,
    description: SessionDescription,
    epoch: number
  ): Promise<void> {
    await peer.setRemoteDescription(description);
    if (!this.isActivePeer(peer, epoch)) return;
    for (const candidate of this.pendingCandidates.splice(0)) {
      await peer.addIceCandidate(candidate);
      if (!this.isActivePeer(peer, epoch)) return;
    }
  }

  private showMediaError(reason: unknown): void {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError' ||
        error.name === 'SecurityError') {
      this.showError('Camera and microphone access was denied. Check browser permissions and try Start again.', error);
    } else if (error.name === 'NotFoundError') {
      this.showError('No camera or microphone was found.', error);
    } else {
      this.showError(`Unable to access camera or microphone: ${error.message}`, error);
    }
  }

  private showCallError(reason: unknown): void {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError' ||
        error.name === 'SecurityError' || error.name === 'NotFoundError') {
      this.showMediaError(error);
      return;
    }
    this.showError(`Unable to start or continue the call: ${error.message}`, error);
  }

  private showError(message: string, error?: unknown): void {
    if (this.destroyed || this.errorMessage === message) return;
    this.errorMessage = message;
    if (error) console.error(message, error);
  }
}
