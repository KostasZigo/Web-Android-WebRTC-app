import {
  AfterViewInit,
  Component,
  ElementRef,
  ViewChild,
  ChangeDetectionStrategy,
  OnDestroy
} from '@angular/core';
import { Subscription } from 'rxjs';
import { DataService } from './service/data.service';
import { IceCandidate, SessionDescription } from './types/message';

const mediaConstraints = {
  audio: true,
  video: { width: 720, height: 540 },
};

const offerOptions = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: true,
};

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class ChatComponent implements AfterViewInit, OnDestroy {
  private readonly signalingSubscriptions = new Subscription();
  private lastSignalingError?: string;
  private localStream!: MediaStream;
  @ViewChild('local_video') localVideo!: ElementRef;
  @ViewChild('received_video') remoteVideo!: ElementRef;

  private peerConnection!: RTCPeerConnection;

  constructor(private dataService: DataService) {}

  ngAfterViewInit(): void {
    this.addIncomingMessageHandling();
    this.requestMediaDevices();
  }

  ngOnDestroy(): void {
    this.signalingSubscriptions.unsubscribe();
    this.dataService.closeWebSocket();
  }

  private async requestMediaDevices(): Promise<void> {
    this.localStream = await navigator.mediaDevices.getUserMedia(
      mediaConstraints
    );
    this.pauseLocalVideo();
  }

  pauseLocalVideo(): void {
    this.localStream.getTracks().forEach((track) => {
      track.enabled = false;
    });
    this.localVideo.nativeElement.srcObject = undefined;
  }

  startLocalVideo(): void {
    this.localStream.getTracks().forEach((track) => {
      track.enabled = true;
    });
    this.localVideo.nativeElement.srcObject = this.localStream;
  }

  private createPeerConnection() {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        {
          urls: ['stun:stun.kundenserver.de:3478'],
        },
      ],
    });
    this.peerConnection.onicecandidate = this.handleICECandidateEvent;
    this.peerConnection.onicegatheringstatechange =
      this.handleIceConnectionStateChangeEvent;
    this.peerConnection.onsignalingstatechange = this.handleSignalingSateEvent;
    this.peerConnection.ontrack = this.handleTrackEvent;
  }

  private closeVideoCall(): void {
    if (this.peerConnection) {
      this.peerConnection.onicecandidate = null;
      this.peerConnection.onicegatheringstatechange = null;
      this.peerConnection.onsignalingstatechange = null;
      this.peerConnection.ontrack = null;
    }

    this.peerConnection.getTransceivers().forEach((transceiver) => {
      transceiver.stop();
    });

    this.peerConnection.close();
    this.createPeerConnection();
  }

  async call(): Promise<void> {
    this.createPeerConnection();
    this.localVideo.nativeElement.srcObject = this.localStream;

    this.localStream
      .getTracks()
      .forEach((track) =>
        this.peerConnection.addTrack(track, this.localStream)
      );

    try {
      const offer: RTCSessionDescriptionInit =
        await this.peerConnection.createOffer(offerOptions);
      if (offer.type !== 'offer' || !offer.sdp) {
        throw new Error('Could not create a valid offer');
      }
      await this.peerConnection.setLocalDescription(offer);

      this.dataService.sendMessage({
        type: 'sdp',
        data: { type: 'offer', sdp: offer.sdp },
        sdp: offer.sdp,
        candidate: '',
        id: '',
        label: '',
      });
    } catch (err) {
      this.handleGetUserMediaError(err);
    }
  }

  private handleGetUserMediaError = (reason: unknown): void => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    switch (error.name) {
      case 'NotFoundError':
        alert('unable to open because no camera/mic');
        break;
      case 'SecurityError':
      case 'PermissionDeniedError':
        //do nothing
        break;
      default:
        console.log(error);
        alert('Error opening your camera ' + error.message);
        break;
    }
    this.closeVideoCall();
  };

  private handleICECandidateEvent = (event: RTCPeerConnectionIceEvent) => {
    if (event.candidate?.candidate) {
      this.dataService.sendMessage({
        type: 'ice',
        data: event.candidate,
        sdp: '',
        candidate: '',
        id: '',
        label: '',
      });
    }
  };

  private handleIceConnectionStateChangeEvent = (event: Event) => {
    console.log(event);
    switch (this.peerConnection.iceConnectionState) {
      case 'closed':
      case 'failed':
      case 'disconnected':
        this.closeVideoCall();
        break;
    }
  };

  private handleSignalingSateEvent = (event: Event) => {
    console.log(event);
    switch (this.peerConnection.signalingState) {
      case 'closed':
        this.closeVideoCall();
        break;
    }
  };

  private handleTrackEvent = (event: RTCTrackEvent) => {
    console.log(event);
    this.remoteVideo.nativeElement.srcObject = event.streams[0];
  };

  private addIncomingMessageHandling(): void {
    this.signalingSubscriptions.add(this.dataService.messages$.subscribe(msg => {
      switch (msg.type) {
        case 'offer':
          this.handleOfferMessage(msg.description);
          break;
        case 'answer':
          this.handleAnswerMessage(msg.description);
          break;
        case 'ice':
          this.handleICECandidateMessage(msg.candidate);
          break;
        case 'peer-left':
          this.handleHangupMessage();
          break;
        case 'matched':
          this.lastSignalingError = undefined;
          break;
        case 'on-going-call':
          alert('A call is already in progress. Try again later.');
          this.dataService.closeWebSocket();
          break;
      }
    }));
    this.signalingSubscriptions.add(this.dataService.errors$.subscribe(error => {
      console.error('Signaling error:', error);
      if (this.lastSignalingError !== error.message) {
        this.lastSignalingError = error.message;
        alert(error.message);
      }
    }));
    this.dataService.connect();
  }

  private handleOfferMessage(msg: SessionDescription): void {
    if (!this.peerConnection) {
      this.createPeerConnection();
    } else {
      this.closeVideoCall();
    }

    if (!this.localStream) {
      this.startLocalVideo();
    }

    this.peerConnection
      .setRemoteDescription(new RTCSessionDescription(msg))
      .then(() => {
        this.localVideo.nativeElement.srcObject = this.localStream;

        this.localStream
          .getTracks()
          .forEach((track) =>
            this.peerConnection.addTrack(track, this.localStream)
          );
      })
      .then(() => {
        return this.peerConnection.createAnswer();
      })
      .then((answer) => {
        return this.peerConnection.setLocalDescription(answer);
      })
      .then(() => {
        const description = this.peerConnection.localDescription;
        if (!description || description.type !== 'answer' || !description.sdp) {
          throw new Error('Could not create a valid answer');
        }
        this.dataService.sendMessage({
          type: 'answer',
          data: { type: 'answer', sdp: description.sdp },
          sdp: description.sdp,
          candidate: '',
          id: '',
          label: '',
        });
      })
      .catch(this.handleGetUserMediaError);
  }

  private handleAnswerMessage(description: SessionDescription): void {
    if (!this.peerConnection) {
      this.reportError(new Error('Received an answer before starting a call'));
      return;
    }
    this.peerConnection.setRemoteDescription(description).catch(this.reportError);
  }

  private handleHangupMessage(): void {
    if (this.peerConnection) this.closeVideoCall();
    this.dataService.closeWebSocket();
  }

  private handleICECandidateMessage(candidate: IceCandidate): void {
    if (!this.peerConnection) {
      this.reportError(new Error('Received ICE before starting a call'));
      return;
    }
    this.peerConnection.addIceCandidate(candidate).catch(this.reportError);
  }

  private reportError = (e: Error) => {
    console.log('got Error: ' + e.name);
    console.log(e);
  };

  hangUp(): void {
    this.dataService.sendMessage({
      type: 'peer-left',
      data: '',
      sdp: '',
      id: '',
      candidate: '',
      label: '',
    });
    this.closeVideoCall();
    this.dataService.connect();
  }
}
