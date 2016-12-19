import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/throw';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/catch';
import { isBrowser } from 'angular2-universal';

import { ReconnectingWebSocket } from './ReconnectingWebsocket';
import {State} from "../reducers/index";
import {Store} from "@ngrx/store";
import {Actions, ConnectionState} from "../reducers/connection";
import {Observer} from "rxjs";

export interface IncomingEvent {
  type: string;
  payload: any;
}

@Injectable()
export class ConnectionService {

    private wsEventListener : Observable<IncomingEvent>;
    private wsEventObserver : Observer<IncomingEvent>;
    private webSocket : ReconnectingWebSocket;

    constructor(private store: Store<State>) {
        if (isBrowser) {
            const protocol = (window.location.protocol == 'https') ? 'wss' : 'ws';
            const url = `${protocol}://${window.location.host}/events`;
            this.webSocket = new ReconnectingWebSocket(url);
            this.webSocket.onopen = this.onOpen.bind(this);
            this.webSocket.onclose = this.onClose.bind(this);
            this.webSocket.onmessage = this.onMessage.bind(this);
        }

        this.wsEventListener = Observable.create((observer) => this.wsEventObserver = observer);
    }

    isConnected() : Observable<Boolean> {
        return this.store.select('connection')
          .map(state => state as ConnectionState)
          .map(state => state.connected);
    }

    getEvents() : Observable<IncomingEvent> {
      return this.wsEventListener;
    }

    private onOpen() {
        console.log("WebSocket connection opened");
        this.store.dispatch({ type : Actions.SET_STATUS, payload: true });
    }

    private onClose() {
        console.log("WebSocket connection closed");
        this.store.dispatch({ type : Actions.SET_STATUS, payload: false });
    }

    private onMessage(messageData : MessageEvent) {
        console.log("Message received", messageData.data);
        this.wsEventObserver.next(JSON.parse(messageData.data) as IncomingEvent);
    }
}
