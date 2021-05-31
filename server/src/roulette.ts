import * as WebSocket from 'ws';
//import { uuid } from 'uuidv4';
const { v4: uuidV4 } = require('uuid');
import { EventEmitter } from 'events';

enum MessageType {
  MATCHED = 'matched',
  SDP = 'sdp',
  ICE = 'ice',
  PEER_LEFT = 'peer-left',
  ON_GOING_CALL = 'on-going-call',
  ANSWER = 'answer'
}

type AnswerMessage = {
  type: MessageType.ANSWER
  sdp: string
}

type MatchMessage = {
  type: MessageType.MATCHED
  match: string
  offer: boolean
}

type SDPMessage = {
  type: MessageType.SDP
  sdp: string
}

type ICEMessage = {
  type: MessageType.ICE
  candidate: string,
  label: number,
  id: string
}

type PeerLeft = {
  type: MessageType.PEER_LEFT
}

type OnGoingCall = {
  type: MessageType.ON_GOING_CALL
}

type ClientMessage
  = MatchMessage
  | SDPMessage
  | ICEMessage
  | PeerLeft
  | OnGoingCall
  | AnswerMessage

type Session = {
  id: string
  ws: WebSocket
  peer?: string
}

export default class Roulette {

  private sessions : Map<string, Session>;
  private unmatched : string;
  private onGoingCall : boolean;

  
  constructor() {
    this.sessions = new Map();
    this.unmatched = "";
	this.onGoingCall = false;
  } 

  register(ws: WebSocket) {
    const id = uuidV4();
    const session = { id, ws };

    
	console.log(id);
	if(this.onGoingCall == false){
		this.sessions.set(id, session);
		this.tryMatch(session);
	}else{
		this.send(session, { type: MessageType.ON_GOING_CALL })
	}
	
    
    ws.on('close', () => this.unregister(id));
    ws.on('error', () => this.unregister(id));
    ws.on('message', (data: WebSocket.Data) => this.handleMessage(id, data.toString()));
  }

  private handleMessage(id: string, data: string) {
    try {
      const message = JSON.parse(data) as ClientMessage;
	  const web_message = JSON.parse(data);
      const session = this.sessions.get(id);
      if(!session) { return console.error(`Can't find session for ${id}`); }
      const peer = this.sessions.get(session.peer);
      if(!peer) { return console.error(`Can't find session for peer of ${id}`); }
      switch (message.type) {
        case MessageType.SDP:
			console.error("ELA 0");
			console.error(`Error sending to ${web_message.hasOwnProperty('data')}`);
			/*
			if(web_message.hasOwnProperty('data')){
				console.error("ELA 1");
				this.send(peer, {type: MessageType.MATCHED, match: session.id, offer: true});
			}*/
			this.send(peer, message);
			break;
		case MessageType.ANSWER:
        case MessageType.ICE:
          this.send(peer, message);
          break;
		case MessageType.PEER_LEFT:
		  this.send(peer, message);
		  this.unregister(session.id);
		  break;
        default:
          console.error(`Unexpected message from ${id}: ${data}`);
          break;
        }
    } catch(err) {
      console.error(`Unexpected error message from ${id}: ${data}`);
    }
  }

  private tryMatch(session: Session) {
    if (this.unmatched != "") {
      const match = this.unmatched;
      const other = this.sessions.get(match);
      if (other) {
		
        session.peer = match;
        other.peer   = session.id;
        this.send(session, {type: MessageType.MATCHED, match: other.id, offer: true});
		this.send(other, {type: MessageType.MATCHED, match: session.id, offer: false});
        this.onGoingCall = true
      }
    } else {
      this.unmatched = session.id;
    }
  }

  private unregister(id: string) {
    const session = this.sessions.get(id);
	if(session && session.peer) {
      const peer = this.sessions.get(session.peer);
      if(peer) this.send(peer, { type: MessageType.PEER_LEFT })
    }
	if(id == this.unmatched){
		this.unmatched = "";
		this.onGoingCall = false
	}
	this.sessions.delete(id);
  }

  private send(session: Session, payload: ClientMessage) {
    try {
      if(session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(JSON.stringify(payload));
      }
    } catch(err) {
      console.error(`Error sending to ${session.id}`);
    }
  }

}