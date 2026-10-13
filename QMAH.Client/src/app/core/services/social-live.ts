import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Observable, Subject, share } from 'rxjs';
import type { HubConnection } from '@microsoft/signalr';

/** 公開社群 SignalR 只傳變更提示，不傳貼文、會員或活動資料。 */
@Injectable({ providedIn: 'root' })
export class SocialLive {
  private readonly document = inject(DOCUMENT);
  readonly changes = new Observable<void>(subscriber => {
    let hub: HubConnection | undefined;
    let closed = false;
    let starting = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const changed = new Subject<void>();
    const subscription = changed.subscribe(() => subscriber.next());
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
          hub = new HubConnectionBuilder().withUrl('/hubs/social-updates')
            .withAutomaticReconnect([0, 1000, 3000, 10000]).configureLogging(LogLevel.None).build();
          hub.on('SocialChanged', () => changed.next());
          hub.onreconnected(() => changed.next());
          hub.onclose(schedule);
        }
        await hub.start();
        if (closed) await hub.stop();
        else changed.next();
      } catch {
        if (!closed) { changed.next(); schedule(); }
      } finally { starting = false; }
    };
    const refresh = () => {
      if (closed || this.document.visibilityState === 'hidden') return;
      changed.next();
      if (!hub || hub.state === 'Disconnected') {
        if (retry) { clearTimeout(retry); retry = undefined; }
        void start();
      }
    };
    const fallback = setInterval(refresh, 45000);
    this.document.defaultView?.addEventListener('online', refresh);
    this.document.addEventListener('visibilitychange', refresh);
    void start();
    return () => {
      closed = true;
      clearInterval(fallback);
      if (retry) clearTimeout(retry);
      subscription.unsubscribe();
      void hub?.stop().catch(() => undefined);
      this.document.defaultView?.removeEventListener('online', refresh);
      this.document.removeEventListener('visibilitychange', refresh);
    };
  }).pipe(share());
}
