import { JSDocComment } from '@angular/compiler';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  Inject,
} from '@angular/core';
import { DataService } from './service/data.service';
import { Message } from './types/message';

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
})
export class ChatComponent implements AfterViewInit {
  private localStream!: MediaStream;
  @ViewChild('local_video') localVideo!: ElementRef;
  @ViewChild('received_video') remoteVideo!: ElementRef;

  private peerConnection!: RTCPeerConnection;

  constructor(private dataService: DataService) {}

  ngAfterViewInit(): void {
    this.addIncomingMessageHandling();
    this.requestMediaDevices();
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
    //stun server , change to the one on android, also maybe change messages
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
        await this.peerConnection.createOffer(offerOptions); //offerOptions
      await this.peerConnection.setLocalDescription(offer);

      this.dataService.sendMessage({
        type: 'sdp',
        data: offer,
        sdp: offer?.sdp,
        candidate: '',
        id: '',
        label: '',
      }); //'offer
    } catch (err) {
      this.handleGetUserMediaError(err);
    }
  }

  private handleGetUserMediaError(e: Error): void {
    switch (e.name) {
      case 'NotFoundError':
        alert('unable to open because no camera/mic');
        break;
      case 'SecurityError':
      case 'PermissionDeniedError':
        //do nothing
        break;
      default:
        console.log(e);
        alert('Error opening your camera ' + e.message);
        break;
    }
    this.closeVideoCall();
  }

  private handleICECandidateEvent = (event: RTCPeerConnectionIceEvent) => {
    console.log(event);
    if (event.candidate) {
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
    var android_message = '2';
    this.dataService.connect();

    this.dataService.messages$.subscribe(
      (msg) => {
        switch (msg.type) {
          case 'sdp': //'offer':
            console.log('11111111111111 ', msg);
            console.log('3333333333 ', msg.data);
            if (msg.data == undefined) {
              msg.data = { type: 'offer', sdp: msg.sdp };
              console.log('NAIIIII');
            }
            console.log('444444444444444 ', msg.data);
            this.handleOfferMessage(msg.data); //msg.data
            break;
          case 'answer':
            this.handleAnswerMessage(msg.data);
            break;
          case 'peer-left': //'hangup':
            this.handleHangupMessage(msg);
            break;
          case 'ice':
            if (msg.data == undefined) {
              msg.data = {
                candidate: msg.candidate,
                sdpMid: msg.id,
                sdpMLineIndex: msg.label,
              };
              console.log('android ', msg.data);
            }
            //console.log('Got ice message : ', msg)
            this.handleICECandidateMessage(msg.data);
            break;
          case 'matched':
            console.log('got message type matched i dont care: ');
            console.log(msg);
            break;
          default:
            console.log('unknown message of type : ' + msg.type);
        }
      },
      (error) => console.log(error)
    );
  }

  private handleOfferMessage(msg: RTCSessionDescriptionInit): void {
    if (!this.peerConnection) {
      this.createPeerConnection();
      console.log("I AM BORN");
    }else{
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
        this.dataService.sendMessage({
          type: 'answer',
          data: this.peerConnection.localDescription,
          sdp: this.peerConnection.localDescription?.sdp,
          candidate: '',
          id: '',
          label: '',
        });
      })
      .catch(this.handleGetUserMediaError);
  }

  private handleAnswerMessage(data: any): void {
    this.peerConnection.setRemoteDescription(data);
  }

  private handleHangupMessage(msg: Message): void {
    this.closeVideoCall();
   // window.location.reload(); //tha to bgalw , dexomai ena peer-left apo to kin pou den to katalabainw
    this.dataService.closeWebSocket()
  }

  private handleICECandidateMessage(data: any): void {
    this.peerConnection.addIceCandidate(data).catch(this.reportError);
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
    this.dataService.connect()
    //window.location.reload();
  }
}
