import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import {webSocket, WebSocketSubject} from 'rxjs/internal-compatibility';
import {Message} from '../types/message';


export const WS_ENDPOINT = "ws://192.168.1.4:8000/" //'ws://localhost:8081';

@Injectable({
  providedIn: 'root'
})
export class DataService {

  private socket$!: WebSocketSubject<Message>;

  private messagesSubject = new Subject<Message>();
  public messages$ = this.messagesSubject.asObservable();

  constructor() { }

  public connect(): void{
    this.socket$ = this.getNewWebSocket();

    this.socket$.subscribe(
      msg => {
        console.log('Received message of type: '+ msg.type);
        this.messagesSubject.next(msg);
      }

    )
  }

  sendMessage(msg: Message): void{
    console.log('sending message' + msg.type);
    this.socket$.next(msg);
  }


  private getNewWebSocket(): WebSocketSubject<any> {
    return webSocket({
      url: WS_ENDPOINT,
      openObserver: {
        next:() => {
          console.log('DataService:  connection OK');
        }
      },
      closeObserver: {
        next: () => {
          console.log('DataService: connection closed');
          this.socket$ = undefined!;
          this.connect();
        }
      }
    });
  }

  public closeWebSocket(): void {
    var wrapper: any = this.socket$;
    wrapper._socket.close();
  }
}
