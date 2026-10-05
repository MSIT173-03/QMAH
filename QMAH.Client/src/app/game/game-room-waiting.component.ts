import { Component, input } from '@angular/core';

import type { GameRoomDetails } from './game.models';
import type { GameRoomComponent } from './game-room.component';

/** 等待入席的牌桌：人數、房間代號、QR 碼與複製；狀態仍在牌桌元件。 */
@Component({
  selector: 'app-game-room-waiting',
  styleUrl: './game-room-waiting.component.scss',
  template: `
        <div class="waiting-table">
          <h1>{{ room().players.length >= room().maxPlayers ? '牌桌坐滿了' : '等大家入座' }}</h1>
          <p class="waiting-count">{{ room().players.length }}／{{ room().maxPlayers }} 位玩家 · {{ room().totalRounds }} 回合</p>
          <div class="invite-card">
            <div class="invite-code"><small>房間代號</small><code>{{ room().roomCode }}</code></div>
            <div class="invite-actions">
              <button type="button" class="tone-blue" (click)="host().qrOpen = true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v3M14 20h3M20 20h1" /></svg>QR 碼</button>
              <button type="button" (click)="host().copyRoomCode(room().roomCode)"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>{{ host().copiedCode ? '已複製' : '複製代號' }}</button>
            </div>
            <p class="invite-note">{{ room().players.length >= room().maxPlayers ? '座位已滿，朋友掃描 QR 碼仍可進場觀戰。' : '朋友掃描 QR 碼，或在大廳輸入代號就能入座。' }}</p>
          </div>
          <p class="waiting-hint">選好牌背並準備，房主就能開始。</p>
        </div>
  `
})
export class GameRoomWaitingComponent {
  readonly room = input.required<GameRoomDetails>();
  readonly host = input.required<GameRoomComponent>();
}
