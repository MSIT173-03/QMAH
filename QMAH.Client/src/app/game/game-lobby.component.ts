import { ChangeDetectorRef, Component, DestroyRef, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, computed, effect, inject, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, Subscription, finalize } from 'rxjs';

import { ApiPage, CreateGameRoomRequest, GameRoomDetails, GameRoomFilterStatus, GameRoomListItem, GameRoomQuery, GameRoomSort, JoinGameRoomRequest } from './game.models';
import { GameNavigationComponent } from './game-navigation.component';
import { GameLobbyRoomBoardComponent } from './game-lobby-room-board.component';
import { GameLobbyRoomDetailDialogComponent } from './game-lobby-room-detail-dialog.component';
import { GameRoomQrDialogComponent } from './game-room-qr-dialog.component';
import { GameScrollPanelComponent } from './game-scroll-panel.component';
import { GameRewardMeterComponent } from './game-reward-meter.component';
import { GameService } from './game.service';
import { MeApiService } from '../core/services/me-api';
import { GameFocusMode } from '../core/services/game-focus-mode';

type LobbyStatus = GameRoomFilterStatus | 'RECENT';

@Component({
  selector: 'app-game-lobby',
  imports: [FormsModule, RouterLink, GameNavigationComponent, GameLobbyRoomBoardComponent, GameLobbyRoomDetailDialogComponent, GameRoomQrDialogComponent, GameScrollPanelComponent, GameRewardMeterComponent],
  templateUrl: './game-lobby.component.html',
  styleUrl: './game-lobby.component.scss'
})
export class GameLobbyComponent implements OnInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  readonly game = inject(GameService);
  readonly meApi = inject(MeApiService);
  readonly focusMode = inject(GameFocusMode);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private routeSubscription?: Subscription;

  createForm: CreateGameRoomRequest = this.game.roomDefaults();
  joinForm: JoinGameRoomRequest = { displayName: '玩家', password: null };
  roomStatus: LobbyStatus = 'WAITING';
  rooms: ApiPage<GameRoomListItem> | null = null;
  selectedRoomId = '';
  roomSort: GameRoomSort = 'RECOMMENDED';
  roomCodeSearch = '';
  roomCodeFilter = '';
  loading = false;
  refreshing = false;
  detailLoading = false;
  creating = false;
  joining = false;
  showCreateForm = false;
  error = '';
  success = '';
  errorTitle = '公開房間目前無法取得';
  readonly loadingRows = [1, 2, 3, 4, 5];
  readonly pageSize = 20;
  isRehearsal = false;
  // 首次進入先看見遊戲入口；仍保留玩家自行收合的偏好。
  heroCollapsed = false;
  qrRoom: Pick<GameRoomListItem, 'id' | 'roomCode'> | null = null;
  @ViewChild('createDialog') private createDialog?: ElementRef<HTMLElement>;
  @ViewChild(GameLobbyRoomDetailDialogComponent) private roomDialog?: GameLobbyRoomDetailDialogComponent;
  private createDialogTrigger: HTMLElement | null = null;
  private qrDialogTrigger: HTMLElement | null = null;

  // ui-integration: 管理員才有「測試模式」入口；一般玩家看不到。
  readonly isAdmin = computed(() => this.meApi.me()?.roles?.includes('Admin') ?? false);
  // 建立／加入房間的顯示名稱預設用會員暱稱，而不是每個人都叫「玩家」；玩家已經自己改過就不覆蓋。
  private readonly defaultPlayerName = effect(() => {
    const name = this.meApi.me()?.displayName?.trim();
    if (!name) return;
    untracked(() => {
      if (this.createForm.displayName === '玩家') this.createForm.displayName = name.slice(0, 80);
      if (this.joinForm.displayName === '玩家') this.joinForm.displayName = name.slice(0, 80);
      this.changeDetector.markForCheck();
    });
  });
  private readonly heroStorageKey = 'qmah.game.lobby.hero-collapsed';

  ngOnInit(): void {
    this.heroCollapsed = this.readHeroCollapsed();
    this.routeSubscription = this.route.queryParamMap.subscribe((params) => {
      // 演練入口已由路由守衛完成管理員驗證，避免重複等待另一份會員快照。
      this.isRehearsal = this.route.snapshot.routeConfig?.path === 'game/test' || params.get('test') === '1';
      const requestedStatus = params.get('status') as LobbyStatus | null;
      this.roomStatus = requestedStatus === 'PLAYING' || requestedStatus === 'COMPLETED' || requestedStatus === 'RECENT' ? requestedStatus : 'WAITING';
      const requestedSort = params.get('sort') as GameRoomSort | null;
      this.roomCodeFilter = (params.get('roomCode') ?? '').trim().toUpperCase();
      this.roomCodeSearch = this.roomCodeFilter;
      this.roomSort = requestedSort === 'NEARLY_FULL' || requestedSort === 'NEWEST' || requestedSort === 'OPEN_SLOTS' ? requestedSort : 'RECOMMENDED';
      this.loadRooms(Math.max(1, Number(params.get('page')) || 1), false);
      const scanned = (params.get('code') ?? '').trim();
      if (scanned && !this.isRehearsal) setTimeout(() => this.quickJoin(scanned));
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    this.listRequest?.unsubscribe();
    this.detailRequest?.unsubscribe();
  }

  loadRooms(page = 1, syncUrl = true): void {
    if (syncUrl) {
      this.router.navigate([], { relativeTo: this.route, queryParams: { status: this.roomStatus === 'WAITING' ? null : this.roomStatus, sort: this.roomSort === 'RECOMMENDED' ? null : this.roomSort, page: page === 1 ? null : page, test: this.isRehearsal ? '1' : null, roomCode: this.roomCodeFilter || null } });
      return;
    }
    this.errorTitle = '公開房間目前無法取得'; this.error = ''; this.selectedRoomId = '';
    this.detailLoading = false;
    this.run(this.roomListRequest(page), (rooms) => (this.rooms = rooms));
  }

  /** 輸入房間代號就直接找到那一桌，開啟入座視窗；找不到會說明原因。 */
  quickJoin(code = this.roomCodeSearch): void {
    const wanted = code.trim().toUpperCase();
    if (!wanted) return;
    this.roomCodeSearch = wanted; this.error = ''; this.success = '';
    const query: GameRoomQuery = { roomCode: wanted, sort: this.roomSort, page: 1, pageSize: 20 };
    (this.isRehearsal ? this.game.getRehearsalRooms(query, false) : this.game.getRooms(query)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: page => {
        const room = page.items.find(item => item.roomCode.toUpperCase() === wanted);
        if (room) this.selectRoom(room);
        else { this.errorTitle = '找不到這個房間'; this.error = `找不到使用代號 ${wanted} 的公開房間，請確認代號是否正確。`; }
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => { this.errorTitle = '找不到這個房間'; this.error = this.game.errorMessage(error); this.changeDetector.markForCheck(); }
    });
  }

  searchRoomCode(): void {
    this.roomCodeFilter = this.roomCodeSearch.trim().toUpperCase();
    this.loadRooms(1);
  }

  clearRoomCode(): void {
    this.roomCodeSearch = ''; this.roomCodeFilter = ''; this.loadRooms(1);
  }

  setRoomStatus(status: LobbyStatus): void {
    if (this.roomStatus === status) return;
    this.roomStatus = status; this.game.clearState(); this.loadRooms();
  }

  isRoomStatusActive(status: LobbyStatus): boolean { return this.roomStatus === status; }

  setRoomSort(sort: GameRoomSort): void {
    if (this.roomSort === sort) return;
    this.roomSort = sort;
    this.loadRooms(1);
  }

  refreshRooms(): void {
    if (this.loading || this.refreshing) return;
    if (!this.rooms) {
      this.loadRooms(1, false);
      return;
    }

    const page = this.rooms.page;
    this.error = '';
    this.success = '';
    this.refreshing = true;

    this.listRequest?.unsubscribe();
    this.listRequest = this.roomListRequest(page, true).pipe(finalize(() => {
      this.refreshing = false;
      this.changeDetector.markForCheck();
    })).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rooms) => {
        this.rooms = rooms;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.error = this.game.errorMessage(error);
        this.changeDetector.markForCheck();
      }
    });
  }

  selectRoom(room: GameRoomListItem): void {
    if (this.isRehearsal) { this.enterRoom(room.id); return; }
    this.selectedRoomId = room.id; this.errorTitle = '目前無法載入房間資訊'; this.success = ''; this.error = '';
    this.focusDialog(() => this.roomDialog?.focusTarget());
    this.detailRequest?.unsubscribe();
    this.game.clearState(); this.detailLoading = true;
    this.detailRequest = this.game.getRoom(room.id).pipe(finalize(() => {
      this.detailLoading = false;
      this.changeDetector.markForCheck();
    })).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.error = this.game.errorMessage(error);
        this.changeDetector.markForCheck();
      }
    });
  }

  currentRoom(): GameRoomDetails | null { return this.game.currentRoom(); }
  canJoinSelectedRoom(): boolean {
    const room = this.currentRoom();
    return !!room && this.game.canJoinRoom(room);
  }
  clearSelection(): void {
    this.detailRequest?.unsubscribe();
    const roomId = this.selectedRoomId;
    this.selectedRoomId = ''; this.game.clearState();
    this.restoreRoomTrigger(roomId);
  }

  toggleHero(): void {
    this.heroCollapsed = !this.heroCollapsed;
    try {
      localStorage.setItem(this.heroStorageKey, String(this.heroCollapsed));
    } catch {
      // ui-integration: 儲存空間被瀏覽器封鎖時仍保留本次操作，不讓收合按鈕失效。
    }
  }

  private readHeroCollapsed(): boolean {
    try {
      const stored = localStorage.getItem(this.heroStorageKey);
      return stored === 'true';
    } catch {
      return false;
    }
  }
  toggleCreateForm(): void {
    if (this.showCreateForm) {
      this.showCreateForm = false;
      this.restoreDialogTrigger(this.createDialogTrigger);
      this.createDialogTrigger = null;
      return;
    }

    this.createDialogTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.showCreateForm = true;
    this.success = '';
    this.focusDialog(() => this.createDialog?.nativeElement);
  }

  createRoom(): void {
    this.creating = true; this.errorTitle = '房間建立失敗'; this.error = ''; this.success = '';
    const request: Observable<Pick<GameRoomDetails, 'id'>> = this.isRehearsal ? this.game.createRehearsalRoom(this.createForm) : this.game.createRoom(this.createForm);
    request.pipe(finalize(() => {
      this.creating = false;
      this.changeDetector.markForCheck();
    })).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (room) => {
        this.showCreateForm = false;
        this.enterRoom(room.id);
      },
      error: (error: unknown) => {
        this.showRoomActionError(error, '房間建立失敗');
        this.changeDetector.markForCheck();
      }
    });
  }

  /** 滿座或已開始的公開房間：不佔席位，直接進牌桌唯讀觀看。 */
  spectateRoom(): void {
    const room = this.currentRoom(); if (room) void this.router.navigate(['/game/room', room.id]);
  }

  joinRoom(): void {
    const room = this.currentRoom(); if (!room) return;
    if (this.isRehearsal) {
      this.enterRoom(room.id);
      return;
    }
    this.joining = true; this.errorTitle = '加入房間失敗'; this.error = ''; this.success = '';
    this.game.joinRoom(room.id, this.joinForm).pipe(finalize(() => {
      this.joining = false;
      this.changeDetector.markForCheck();
    })).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (joinedRoom) => {
        this.enterRoom(joinedRoom.id);
      },
      error: (error: unknown) => {
        this.showRoomActionError(error, '加入房間失敗');
        this.changeDetector.markForCheck();
      }
    });
  }

  private enterRoom(roomId: string): void {
    void this.router.navigate(['/game/room', roomId], { queryParams: this.isRehearsal ? { test: '1' } : undefined });
  }

  private showRoomActionError(error: unknown, fallbackTitle: string): void {
    if (error instanceof HttpErrorResponse && error.status === 401) {
      this.errorTitle = '請先登入';
      this.error = '請先登入會員帳號，再建立或加入房間。';
      return;
    }
    this.errorTitle = fallbackTitle;
    this.error = this.game.errorMessage(error);
  }

  copyRoomCode(roomCode: string): void {
    if (!roomCode) return;
    if (!navigator.clipboard?.writeText) {
      this.errorTitle = '無法複製房間代碼';
      this.error = '此瀏覽器不支援一鍵複製，請直接選取房間代碼。';
      return;
    }
    void navigator.clipboard.writeText(roomCode).then(() => {
      this.error = '';
      this.success = '房間代碼已複製。';
      this.changeDetector.markForCheck();
    }).catch(() => {
      this.errorTitle = '無法複製房間代碼';
      this.error = '請直接選取房間代碼後複製。';
      this.changeDetector.markForCheck();
    });
  }

  openRoomQr(room: Pick<GameRoomListItem, 'id' | 'roomCode'>): void {
    this.qrDialogTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.qrRoom = room;
    this.error = '';
  }

  closeRoomQr(): void {
    this.qrRoom = null;
    this.restoreDialogTrigger(this.qrDialogTrigger);
    this.qrDialogTrigger = null;
  }

  @HostListener('document:keydown.escape')
  closeTransientPanel(): void {
    if (this.qrRoom) { this.closeRoomQr(); return; }
    if (this.showCreateForm) { this.toggleCreateForm(); return; }
    if (this.selectedRoomId) { this.clearSelection(); return; }
  }

  @HostListener('document:keydown.tab', ['$event'])
  keepDialogFocus(event: Event): void {
    if (!(event instanceof KeyboardEvent)) return;
    if (this.qrRoom) return;
    const dialog = this.showCreateForm ? this.createDialog?.nativeElement : this.selectedRoomId ? this.roomDialog?.focusTarget() : null;
    if (!dialog) return;
    const controls = Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((control) => control.getClientRects().length > 0);
    if (!controls.length) { event.preventDefault(); dialog.focus(); return; }
    const first = controls[0];
    const last = controls[controls.length - 1];
    // 對話框開啟時，Tab 與 Shift+Tab 都留在可操作控制項內。
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
      event.preventDefault(); first.focus();
    }
  }

  private listRequest?: Subscription;
  private detailRequest?: Subscription;
  private run<T>(request: Observable<T>, assign: (value: T) => void): void {
    this.listRequest?.unsubscribe();
    this.loading = true;
    this.listRequest = request.pipe(finalize(() => {
      this.loading = false;
      this.changeDetector.markForCheck();
    })).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (value) => {
        assign(value);
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.error = this.game.errorMessage(error);
        this.changeDetector.markForCheck();
      }
    });
  }

  private focusDialog(getDialog: () => HTMLElement | undefined): void {
    setTimeout(() => {
      const dialog = getDialog();
      if (!dialog) return;
      const firstControl = dialog.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
      );
      (firstControl ?? dialog).focus();
    }, 0);
  }

  private restoreDialogTrigger(trigger: HTMLElement | null): void {
    setTimeout(() => trigger?.focus(), 0);
  }

  private restoreRoomTrigger(roomId: string): void {
    setTimeout(() => {
      const trigger = Array.from(document.querySelectorAll<HTMLButtonElement>('.room-row'))
        .find((button) => button.dataset['roomId'] === roomId) ?? document.querySelector<HTMLButtonElement>('.room-row');
      trigger?.focus();
    }, 0);
  }

  private roomListRequest(page: number, refresh = false): Observable<ApiPage<GameRoomListItem>> {
    const query: GameRoomQuery = {
      roomCode: this.roomCodeFilter || undefined,
      status: this.roomStatus === 'RECENT' ? 'COMPLETED' : this.roomStatus,
      sort: this.roomSort,
      page,
      pageSize: this.pageSize
    };
    return this.isRehearsal ? this.game.getRehearsalRooms(query, refresh) : this.game.getRooms(query);
  }
}
