import { JsonPipe } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, finalize } from 'rxjs';

import {
  ApiPage,
  GameRoomFilterStatus,
  GameRoomListItem,
} from './game.models';
import { GameNavigationComponent } from './game-navigation.component';
import { GameService } from './game.service';
import { QmahIconComponent } from '../shared/components/qmah-icon/qmah-icon';
import { GameFocusMode } from '../core/services/game-focus-mode';

interface TestRoomOption {
  id: string;
  code: string;
  name: string;
  description: string;
}

@Component({
  selector: 'app-game-test',
  imports: [FormsModule, JsonPipe, RouterLink, GameNavigationComponent, QmahIconComponent],
  styleUrl: './game-test.component.scss',
  template: `
    <div class="game-test-page" [class.is-focus-mode]="focusMode.active()">
      <!-- ui-integration: 管理員檢查中心沿用 Game 導覽，讓正式工具有清楚入口與返回大廳的出口。 -->
      <app-game-navigation />
      <header class="tools-heading"><h1>流程演練</h1><a routerLink="/game">返回房間大廳</a></header>
      <div class="tools-tabs" role="group" aria-label="管理員工具內容">
        <button type="button" [attr.aria-pressed]="panel === 'rehearsal'" (click)="selectPanel('rehearsal')">遊戲流程</button>
        <button type="button" [attr.aria-pressed]="panel === 'service'" (click)="selectPanel('service')">服務檢查</button>
      </div>
      @if (panel === 'rehearsal') {
      <section class="test-launcher" aria-labelledby="test-launcher-title">
        <header>
          <h2 id="test-launcher-title">選擇演練節奏</h2>
          <p class="description">從現有會員抽出模擬玩家，使用同件文物的歷史回答。沿用正式遊戲畫面，不建立正式房間，也不發放獎勵。</p>
        </header>
        <div class="rehearsal-picker">
          <div class="rehearsal-menu" role="group" aria-label="演練情境">
          @for (room of testRooms; track room.id) {
            <button type="button" [attr.aria-pressed]="selectedRoomId === room.id" (click)="selectedRoomId = room.id"><strong>{{ room.name }}</strong><span>{{ room.description }}</span></button>
          }
          </div>
          <section class="rehearsal-preview" aria-labelledby="rehearsal-title">
            <h3 id="rehearsal-title">{{ selectedScenario.name }}</h3>
            <ol class="rehearsal-flow" aria-label="演練流程"><li>等待入席</li><li>觀察作答</li><li>匿名投票</li><li>揭曉館藏</li><li>本局結算</li></ol>
            <p>模擬玩家會在不同時間作答。可暫停、跳過等待或重新抽取，結束後再回來選擇其他節奏。</p>
            <button type="button" class="rehearsal-start" (click)="joinTestRoom(selectedRoomId)">開始演練 <app-qmah-icon name="arrow-right" aria-hidden="true" /></button>
          </section>
        </div>
      </section>
      } @else {
      <header class="diagnostics-heading">
        <div>
          <h2>公開房間 API 讀取狀態</h2>
        </div>
        <p class="description">
          這項檢查只確認目前登入狀態能否讀取公開房間，不代表作答、投票或結算 API 都正常。
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
      }
    </div>
  `
})
export class GameTestComponent {
  readonly game = inject(GameService);
  readonly focusMode = inject(GameFocusMode);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly changeDetector = inject(ChangeDetectorRef);
  panel: 'rehearsal' | 'service' = this.route.snapshot.queryParamMap.get('panel') === 'service' ? 'service' : 'rehearsal';
  selectedRoomId = this.route.snapshot.queryParamMap.get('scenario') ?? 'test-room-quick';
  get selectedScenario(): TestRoomOption { return this.testRooms.find(room => room.id === this.selectedRoomId) ?? this.testRooms[0]; }
  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      this.panel = params.get('panel') === 'service' ? 'service' : 'rehearsal';
      this.changeDetector.markForCheck();
    });
  }
  selectPanel(panel: 'rehearsal' | 'service'): void {
    this.panel = panel;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { panel: panel === 'service' ? 'service' : null }, queryParamsHandling: 'merge' });
  }

  readonly testRooms: TestRoomOption[] = [
    { id: 'test-room-quick', code: 'A101', name: '快速巡覽', description: '兩回合、自動走完各階段。' },
    { id: 'test-room-standard', code: 'A103', name: '完整流程', description: '節奏較寬，方便逐步檢查作答、投票、揭曉與結算。' },
    { id: 'test-room-replay', code: 'A102', name: '重播檢查', description: '每次加入都從初始狀態開始，可重複檢查同一條流程。' }
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
    this.selectedRoomId = this.selectedScenario.id;
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
      UNKNOWN: '尚未讀取公開房間',
      CHECKING: '正在讀取公開房間',
      ONLINE: '公開房間讀取成功',
      OFFLINE: '公開房間讀取失敗'
    }[this.serviceStatus];
  }

  private currentTimeLabel(): string {
    return new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  private run<T>(request: Observable<T>, assign: (value: T) => void, onError?: () => void): void {
    this.loading = true;
    this.error = '';
    request.pipe(finalize(() => { this.loading = false; this.changeDetector.markForCheck(); })).subscribe({
      next: (value) => { assign(value); this.changeDetector.markForCheck(); },
      error: (error: unknown) => {
        this.error = this.game.errorMessage(error);
        onError?.();
      }
    });
  }
}
