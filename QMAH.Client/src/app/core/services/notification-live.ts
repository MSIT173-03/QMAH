import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, Subject, distinctUntilChanged, filter, map, merge, share, switchMap } from 'rxjs';
import type { HubConnection } from '@microsoft/signalr';
import { MeApiService } from './me-api';

/** 全站共用一條通知連線，與遊戲連線分開；重連後補讀遺漏的變動。 */
@Injectable({ providedIn: 'root' })
export class NotificationLive {
  private readonly document = inject(DOCUMENT);
  private readonly localChanges = new Subject<'notifications'>();
  private readonly events = toObservable(inject(MeApiService).me).pipe(
    map(user => user?.id ?? null),
    distinctUntilChanged(),
    switchMap(userId => userId ? merge(this.connect(), this.localChanges) : EMPTY),
    share()
  );
  readonly changes = this.events.pipe(filter(event => event !== 'economy'));
  readonly economyChanges = this.events.pipe(filter(event => event !== 'notifications'));
  refresh(): void { this.localChanges.next('notifications'); }

  private connect(): Observable<'notifications' | 'economy' | 'refresh-all'> {
    return new Observable(subscriber => {
      let hub: HubConnection | undefined;
      let closed = false;
      let starting = false;
      let retry: ReturnType<typeof setTimeout> | undefined;
      const schedule = () => {
        if (!closed && !retry) retry = setTimeout(() => { retry = undefined; void start(); }, 15000);
      };
      const start = async () => {
        if (closed || starting) return;
        starting = true;
        try {
          if (!hub) {
            const { HubConnectionBuilder, LogLevel } = await import('@microsoft/signalr');
            if (closed) return;
            hub = new HubConnectionBuilder().withUrl('/hubs/notifications')
              .withAutomaticReconnect([0, 1000, 3000, 10000]).configureLogging(LogLevel.None).build();
            hub.on('NotificationsChanged', () => subscriber.next('notifications'));
            hub.on('EconomyChanged', () => subscriber.next('economy'));
            hub.onreconnected(() => subscriber.next('refresh-all'));
            hub.onclose(schedule);
          }
          await hub.start();
          if (closed) await hub.stop();
          else subscriber.next('refresh-all');
        } catch {
          // A failed lazy chunk/build must retry initialization too. Refresh by
          // HTTP meanwhile, so notifications do not stay frozen until reload.
          if (!closed) { subscriber.next('refresh-all'); schedule(); }
        } finally { starting = false; }
      };
      // 推播中斷或伺服器偵測漏失時仍會補讀；背景分頁不輪詢。
      const fallback = setInterval(() => {
        if (!closed && this.document.visibilityState !== 'hidden') subscriber.next('refresh-all');
      }, 45000);
      const online = () => {
        if (closed) return;
        subscriber.next('refresh-all');
        if (!hub || hub.state === 'Disconnected') {
          if (retry) { clearTimeout(retry); retry = undefined; }
          void start();
        }
      };
      this.document.defaultView?.addEventListener('online', online);
      void start();
      return () => {
        closed = true;
        clearInterval(fallback);
        this.document.defaultView?.removeEventListener('online', online);
        if (retry) clearTimeout(retry);
        void hub?.stop().catch(() => undefined);
      };
    });
  }
}
