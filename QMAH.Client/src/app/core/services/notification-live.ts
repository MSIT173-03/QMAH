import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, distinctUntilChanged, map, share, switchMap } from 'rxjs';
import type { HubConnection } from '@microsoft/signalr';
import { MeApiService } from './me-api';

/** 全站共用一條通知連線，與遊戲連線分開；重連後補讀遺漏的變動。 */
@Injectable({ providedIn: 'root' })
export class NotificationLive {
  readonly changes = toObservable(inject(MeApiService).me).pipe(
    map(user => user?.id ?? null),
    distinctUntilChanged(),
    switchMap(userId => userId ? this.connect() : EMPTY),
    share()
  );

  private connect(): Observable<void> {
    return new Observable(subscriber => {
      let hub: HubConnection | undefined;
      let closed = false;
      let retry: ReturnType<typeof setTimeout> | undefined;
      const schedule = () => {
        if (!closed && !retry) retry = setTimeout(() => { retry = undefined; void start(); }, 15000);
      };
      const start = async () => {
        if (closed || !hub) return;
        try { await hub.start(); if (!closed) subscriber.next(); }
        catch { schedule(); }
      };
      void import('@microsoft/signalr').then(({ HubConnectionBuilder, LogLevel }) => {
        if (closed) return;
        hub = new HubConnectionBuilder().withUrl('/hubs/notifications')
          .withAutomaticReconnect([0, 1000, 3000, 10000]).configureLogging(LogLevel.None).build();
        hub.on('NotificationsChanged', () => subscriber.next());
        hub.onreconnected(() => subscriber.next());
        hub.onclose(schedule);
        void start();
      }).catch(schedule);
      return () => {
        closed = true;
        if (retry) clearTimeout(retry);
        void hub?.stop().catch(() => undefined);
      };
    });
  }
}
