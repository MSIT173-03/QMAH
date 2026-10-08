import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import type { HubConnection } from '@microsoft/signalr';

/**
 * 牌桌即時通知（SignalR）。
 * 原理：伺服器只推一則「這桌有變」的訊號，不帶任何遊戲資料；
 * 收到後畫面仍用既有 HTTP API 重新讀取，所以作者、票數的匿名規則完全不變。
 * 好處：人再多也只是一則小訊號；斷線時外層會退回輪詢，不會卡住。
 */
@Injectable({ providedIn: 'root' })
export class GameRoomLive {
  /**
   * 訂閱一桌的變動訊號：連線成功、斷線重連、以及每次伺服器通知都會發出一次。
   * 取消訂閱即離開房間並關閉連線。onState 回報目前是否連線中。
   */
  watch(roomId: string, onState: (connected: boolean) => void): Observable<void> {
    return new Observable<void>(subscriber => {
      let hub: HubConnection | undefined;
      let closed = false;
      let retry: ReturnType<typeof setTimeout> | undefined;

      const connect = async (): Promise<void> => {
        if (!hub || closed) return;
        try {
          await hub.start();
          await hub.invoke('JoinRoom', roomId);
          onState(true);
          subscriber.next();
        } catch {
          onState(false);
          if (!closed) retry = setTimeout(() => void connect(), 15000);
        }
      };

      // SignalR 約 150 kB，動態載入，只有進牌桌才會下載。
      void import('@microsoft/signalr').then(({ HubConnectionBuilder, LogLevel }) => {
        if (closed) return;
        hub = new HubConnectionBuilder()
          .withUrl('/hubs/game-room')
          // 短暫斷線自動重連（0、1、3、5、10、20 秒）；全部失敗才算關閉，再由下方每 15 秒重試。
          .withAutomaticReconnect([0, 1000, 3000, 5000, 10000, 20000])
          .configureLogging(LogLevel.None)
          .build();
        hub.on('RoomChanged', () => subscriber.next());
        hub.onreconnecting(() => onState(false));
        hub.onreconnected(async () => {
          // 重連後群組要重新加入，並立刻補讀一次錯過的變動。
          try { await hub?.invoke('JoinRoom', roomId); onState(true); subscriber.next(); } catch { onState(false); }
        });
        hub.onclose(() => {
          onState(false);
          if (!closed) retry = setTimeout(() => void connect(), 15000);
        });
        void connect();
      });

      return () => {
        closed = true;
        if (retry) clearTimeout(retry);
        void hub?.stop();
      };
    });
  }
}
