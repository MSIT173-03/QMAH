import { JsonPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable, finalize } from 'rxjs';

import {
  ApiPage,
  GameRoomFilterStatus,
  GameRoomListItem,
} from './game.models';
import { GameNavigationComponent } from './game-navigation.component';
import { GameService } from './game.service';

interface TestRoomOption {
  id: string;
  code: string;
  name: string;
  description: string;
}

@Component({
  selector: 'app-game-test',
  imports: [FormsModule, JsonPipe, RouterLink, GameNavigationComponent],
  styleUrl: './game-test.component.scss',
  template: `
    <div class="game-test-page">
      <!-- ui-integration: 管理員檢查中心沿用 Game 導覽，讓正式工具有清楚入口與返回大廳的出口。 -->
      <app-game-navigation><a routerLink="/game">返回多人鑑定大廳</a></app-game-navigation>
      <section class="test-launcher" aria-labelledby="test-launcher-title">
        <header>
          <p class="eyebrow">管理員工具 · 遊戲檢查中心</p>
          <h1 id="test-launcher-title">檢查遊戲流程與服務</h1>
          <p class="description">用隔離測試房間檢查畫面與跳轉，也能讀取目前遊戲 API 的公開房間資料確認服務是否接通。測試流程不建立會員、房間或獎勵紀錄。</p>
        </header>
        <div class="test-safety-note" role="note">
          <strong>僅限管理員</strong>
          <span>這裡的測試玩家與獎勵都是前端隔離資料，不會影響正式玩家。</span>
        </div>
        <div class="test-section-heading">
          <div>
            <p class="eyebrow">流程預覽</p>
            <h2>選一間測試房間</h2>
          </div>
          <span class="section-note">可重複進入</span>
        </div>
        <div class="test-room-grid">
          @for (room of testRooms; track room.id) {
            <article class="test-room-card">
              <span class="test-room-code">{{ room.code }}</span>
              <h2>{{ room.name }}</h2>
              <p>{{ room.description }}</p>
              <button type="button" (click)="joinTestRoom(room.id)">加入測試房間 <span aria-hidden="true">→</span></button>
            </article>
          }
        </div>
      </section>
      <header class="diagnostics-heading">
        <div>
          <p class="eyebrow">只讀連線檢查</p>
          <h2>遊戲服務狀態</h2>
        </div>
        <p class="description">
          這項檢查代表目前前端能否用登入狀態讀取遊戲 API；它是操作層煙霧檢查，不取代伺服器本身的健康監控。
        </p>
      </header>

      <section class="service-status" [class.is-checking]="serviceStatus === 'CHECKING'" [class.is-online]="serviceStatus === 'ONLINE'" [class.is-offline]="serviceStatus === 'OFFLINE'" aria-live="polite">
        <span class="service-status__dot" aria-hidden="true"></span>
        <div>
          <strong>{{ serviceStatusText() }}</strong>
          <span>{{ lastCheckedLabel }}</span>
        </div>
        <button type="button" (click)="loadRooms()" [disabled]="loading || serviceStatus === 'CHECKING'">{{ serviceStatus === 'CHECKING' ? '檢查中…' : '重新檢查' }}</button>
      </section>

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
    </div>
  `
})
export class GameTestComponent {
  readonly game = inject(GameService);
  private readonly router = inject(Router);

  readonly testRooms: TestRoomOption[] = [
    { id: 'test-room-quick', code: 'QA-快轉', name: '快速巡覽', description: '約半分鐘跑完兩回合，適合先確認主要畫面與路由出口。' },
    { id: 'test-room-standard', code: 'QA-完整', name: '完整流程', description: '節奏較寬，方便逐步檢查作答、投票、揭曉與結算。' },
    { id: 'test-room-replay', code: 'QA-重播', name: '重播檢查', description: '每次加入都從乾淨狀態開始，可重複檢查同一條流程。' }
  ];

  roomStatus: GameRoomFilterStatus | '' = '';
  roomId = '';
  roundId = '';
  rooms: ApiPage<GameRoomListItem> | null = null;
  error = '';
  loading = false;
  serviceStatus: 'UNKNOWN' | 'CHECKING' | 'ONLINE' | 'OFFLINE' = 'UNKNOWN';
  lastCheckedLabel = '尚未檢查';

  ngOnInit(): void {
    // ui-integration: 進入正式檢查中心即先做一次只讀連線檢查，管理員不必再猜測服務是否可用。
    this.loadRooms();
  }

  joinTestRoom(roomId: string): void {
    // ui-integration: 測試房間只進入前端隔離的 GameRoomComponent 狀態，不呼叫正式加入 API 或留下會員紀錄。
    void this.router.navigate(['/game/room', roomId], { queryParams: { test: '1' } });
  }

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
    this.serviceStatus = 'CHECKING';
    this.lastCheckedLabel = '正在讀取公開房間…';
    this.run(
      this.game.getRooms({ status: this.roomStatus || undefined }),
      (rooms) => {
        this.rooms = rooms;
        this.serviceStatus = 'ONLINE';
        this.lastCheckedLabel = `最近檢查 ${this.currentTimeLabel()}`;
      },
      () => {
        this.serviceStatus = 'OFFLINE';
        this.lastCheckedLabel = `最近失敗 ${this.currentTimeLabel()}`;
      }
    );
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

  serviceStatusText(): string {
    return {
      UNKNOWN: '尚未檢查遊戲 API',
      CHECKING: '正在檢查遊戲 API',
      ONLINE: '遊戲 API 可連線',
      OFFLINE: '遊戲 API 暫時無法連線'
    }[this.serviceStatus];
  }

  private currentTimeLabel(): string {
    return new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  private run<T>(request: Observable<T>, assign: (value: T) => void, onError?: () => void): void {
    this.loading = true;
    this.error = '';
    request.pipe(finalize(() => (this.loading = false))).subscribe({
      next: assign,
      error: (error: unknown) => {
        this.error = this.game.errorMessage(error);
        onError?.();
      }
    });
  }
}
