import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { HubConnection } from '@microsoft/signalr';

/** 只推房間變更提示，遊戲資料與匿名規則仍由 HTTP API 決定。 */
@Injectable({ providedIn: 'root' })
export class GameRoomLive {
  private readonly document = inject(DOCUMENT);

  watch(roomId: string, onState: (connected: boolean) => void): Observable<void> {
    return new Observable<void>(subscriber => {
      let hub: HubConnection | undefined;
      let closed = false;
      let starting = false;
      let retry: ReturnType<typeof setTimeout> | undefined;
      const state = (connected: boolean) => { if (!closed) onState(connected); };
      const schedule = () => {
        if (!closed && !retry) retry = setTimeout(() => { retry = undefined; void connect(); }, 15000);
      };
      const join = async () => {
        if (!hub || closed) return;
        await hub.invoke('JoinRoom', roomId);
        if (!closed) { state(true); subscriber.next(); }
      };
      const connect = async (): Promise<void> => {
        if (closed || starting) return;
        starting = true;
        try {
          if (!hub) {
            // 動態載入失敗也會進入重試，不留下未處理的 Promise。
            const { HubConnectionBuilder, LogLevel } = await import('@microsoft/signalr');
            if (closed) return;
            hub = new HubConnectionBuilder().withUrl('/hubs/game-room')
              .withAutomaticReconnect([0, 1000, 3000, 5000, 10000, 20000])
              .configureLogging(LogLevel.None).build();
            hub.on('RoomChanged', () => subscriber.next());
            hub.onreconnecting(() => state(false));
            hub.onreconnected(() => { void connect(); });
            hub.onclose(() => { state(false); schedule(); });
          }
          // JoinRoom 失敗時連線可能仍然有效，只重試加入房間。
          if (hub.state === 'Disconnected') await hub.start();
          if (closed) { await hub.stop(); return; }
          if (hub.state === 'Connected') await join();
        } catch {
          state(false);
          schedule();
        } finally { starting = false; }
      };
      const refresh = () => {
        if (closed || this.document.visibilityState === 'hidden') return;
        subscriber.next();
        if (!hub || hub.state === 'Disconnected' || hub.state === 'Connected') {
          if (retry) { clearTimeout(retry); retry = undefined; }
          void connect();
        }
      };
      this.document.defaultView?.addEventListener('online', refresh);
      this.document.addEventListener('visibilitychange', refresh);
      void connect();
      return () => {
        closed = true;
        if (retry) clearTimeout(retry);
        this.document.defaultView?.removeEventListener('online', refresh);
        this.document.removeEventListener('visibilitychange', refresh);
        void hub?.stop().catch(() => undefined);
      };
    });
  }
}
