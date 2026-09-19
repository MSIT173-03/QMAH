import { JsonPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, finalize } from 'rxjs';

import {
  ApiPage,
  GameRoomFilterStatus,
  GameRoomListItem,
} from './game.models';
import { GameService } from './game.service';

@Component({
  selector: 'app-game-test',
  imports: [FormsModule, JsonPipe],
  template: `
    <main class="game-test-page">
      <header>
        <p class="eyebrow">清明鑑定屋 · 遊戲服務</p>
        <h1>遊戲 API 測試頁</h1>
        <p class="description">
          這裡只讀取房間與回合資料，用來確認前台 service、登入 Cookie 與 API proxy 是否接通。
        </p>
      </header>

      @if (error) {
        <p class="message error" role="alert">{{ error }}</p>
      }
      @if (loading) {
        <p class="message" role="status">正在讀取遊戲 API…</p>
      }

      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>公開房間</h2>
            <p>未指定狀態時，API 會回傳等待中的房間。</p>
          </div>
          <button type="button" (click)="loadRooms()" [disabled]="loading">重新讀取</button>
        </div>
        <label>
          房間狀態
          <select [(ngModel)]="roomStatus">
            <option value="">等待中的房間</option>
            <option value="PLAYING">進行中</option>
            <option value="COMPLETED">已完成</option>
          </select>
        </label>
        @if (rooms) {
          <pre>{{ rooms | json }}</pre>
        } @else {
          <p class="muted">按下「重新讀取」開始測試。</p>
        }
      </section>

      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>房間與回合</h2>
            <p>貼上 API 回傳的 GUID，確認詳細資料與階段判斷。</p>
          </div>
        </div>
        <div class="fields">
          <label>
            房間 ID
            <input [(ngModel)]="roomId" placeholder="例如：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
          </label>
          <button type="button" (click)="loadRoom()" [disabled]="loading">讀取房間</button>
          <label>
            回合 ID
            <input [(ngModel)]="roundId" placeholder="例如：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
          </label>
          <button type="button" (click)="loadRound()" [disabled]="loading">讀取回合</button>
        </div>

        @if (game.currentRoom(); as room) {
          <div class="summary">
            <strong>房間 {{ room.roomCode }}</strong>
            <span>{{ roomStatusText(room.status) }} · {{ room.players.length }}/{{ room.maxPlayers }} 人</span>
            <span>{{ visibilityText(room.visibility) }}</span>
          </div>
          <pre>{{ room | json }}</pre>
        }

        @if (game.currentRound(); as round) {
          <div class="summary">
            <strong>第 {{ round.roundNumber }} 回合</strong>
            <span>{{ roundStatusText(round.status) }}</span>
            <span>回答：{{ game.canAnswer(round) ? '可進行' : '已關閉' }}</span>
            <span>投票：{{ game.canVote(round) ? '可進行' : '已關閉' }}</span>
          </div>
          <pre>{{ round | json }}</pre>
        }
      </section>
    </main>
  `,
  styles: `
    :host { display: block; min-height: 100vh; background: #f6f7fb; color: #1f2937; }
    .game-test-page { box-sizing: border-box; max-width: 960px; margin: 0 auto; padding: 3rem 1.25rem; }
    header { margin-bottom: 1.5rem; }
    .eyebrow { margin: 0 0 .5rem; color: #64748b; font-size: .75rem; font-weight: 700; letter-spacing: .12em; }
    h1, h2 { margin: 0; }
    h1 { font-size: clamp(1.8rem, 4vw, 2.6rem); }
    h2 { font-size: 1.1rem; }
    .description, .panel-heading p, .muted { color: #64748b; }
    .description { max-width: 42rem; margin: .75rem 0 0; line-height: 1.6; }
    .panel { margin-top: 1rem; padding: 1.25rem; border: 1px solid #dbe2ea; border-radius: .75rem; background: #fff; box-shadow: 0 8px 24px rgb(15 23 42 / 5%); }
    .panel-heading, .summary { display: flex; align-items: center; gap: .75rem; justify-content: space-between; }
    .panel-heading p { margin: .35rem 0 0; font-size: .9rem; }
    label { display: grid; gap: .35rem; margin-top: 1rem; font-weight: 600; }
    input, select { box-sizing: border-box; min-height: 2.5rem; padding: .55rem .7rem; border: 1px solid #cbd5e1; border-radius: .45rem; background: #fff; color: inherit; font: inherit; }
    button { min-height: 2.5rem; padding: .55rem .85rem; border: 0; border-radius: .45rem; background: #1d4ed8; color: #fff; cursor: pointer; font: inherit; font-weight: 700; }
    button:disabled { cursor: wait; opacity: .55; }
    pre { max-height: 24rem; overflow: auto; margin: 1rem 0 0; padding: 1rem; border-radius: .45rem; background: #0f172a; color: #dbeafe; font-size: .8rem; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
    .message { margin: 1rem 0; padding: .75rem 1rem; border-radius: .45rem; background: #e0f2fe; }
    .message.error { background: #fee2e2; color: #991b1b; }
    .fields { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .75rem 1rem; align-items: end; }
    .fields label { margin-top: 0; }
    .summary { justify-content: flex-start; flex-wrap: wrap; margin-top: 1.25rem; padding: .75rem; border-radius: .45rem; background: #eff6ff; }
    .summary span { color: #475569; font-size: .9rem; }
    @media (max-width: 640px) { .panel-heading, .fields { grid-template-columns: 1fr; display: grid; } .panel-heading button, .fields button { width: 100%; } }
  `
})
export class GameTestComponent {
  readonly game = inject(GameService);

  roomStatus: GameRoomFilterStatus | '' = '';
  roomId = '';
  roundId = '';
  rooms: ApiPage<GameRoomListItem> | null = null;
  error = '';
  loading = false;

  roomStatusText(status: GameRoomListItem['status']): string {
    return { WAITING: '等待中', PLAYING: '進行中', COMPLETED: '已完成', CANCELLED: '已取消' }[status];
  }

  visibilityText(visibility: 'PUBLIC' | 'PRIVATE'): string {
    return visibility === 'PRIVATE' ? '私人房間' : '公開房間';
  }

  roundStatusText(status: 'ANSWERING' | 'VOTING' | 'REVEALED'): string {
    return { ANSWERING: '作答中', VOTING: '投票中', REVEALED: '已揭曉' }[status];
  }

  loadRooms(): void {
    this.run(this.game.getRooms({ status: this.roomStatus || undefined }), (rooms) => {
      this.rooms = rooms;
    });
  }

  loadRoom(): void {
    if (!this.roomId.trim()) {
      this.error = '請先輸入房間 ID。';
      return;
    }
    this.run(this.game.getRoom(this.roomId.trim()), () => undefined);
  }

  loadRound(): void {
    if (!this.roundId.trim()) {
      this.error = '請先輸入回合 ID。';
      return;
    }
    this.run(this.game.getRound(this.roundId.trim()), () => undefined);
  }

  private run<T>(request: Observable<T>, assign: (value: T) => void): void {
    this.loading = true;
    this.error = '';
    request.pipe(finalize(() => (this.loading = false))).subscribe({
      next: assign,
      error: (error: unknown) => (this.error = this.game.errorMessage(error))
    });
  }
}
