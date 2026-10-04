import { ChangeDetectorRef, Component, DestroyRef, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, computed, inject } from '@angular/core';
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
  demoRoom: GameRoomDetails | null = null;
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
  isDemo = false;
  isRehearsal = false;
  // 首次進入先看見遊戲入口；仍保留玩家自行收合的偏好。
  heroCollapsed = false;
  qrRoom: Pick<GameRoomListItem, 'id' | 'roomCode'> | null = null;
  @ViewChild('createDialog') private createDialog?: ElementRef<HTMLElement>;
  @ViewChild(GameLobbyRoomDetailDialogComponent) private roomDialog?: GameLobbyRoomDetailDialogComponent;
  private createDialogTrigger: HTMLElement | null = null;
  private qrDialogTrigger: HTMLElement | null = null;

  // ui-integration: 展示模式只對已登入管理員提供入口與標示；一般玩家不會被開發用 Demo 文案干擾。
  readonly isAdmin = computed(() => this.meApi.me()?.roles?.includes('Admin') ?? false);
  private readonly heroStorageKey = 'qmah.game.lobby.hero-collapsed';
  private demoRefreshCount = 0;

  ngOnInit(): void {
    this.heroCollapsed = this.readHeroCollapsed();
    this.routeSubscription = this.route.queryParamMap.subscribe((params) => {
      this.isDemo = this.route.snapshot.routeConfig?.path === 'game/demo';
      // 演練入口已由路由守衛完成管理員驗證，避免重複等待另一份會員快照。
      this.isRehearsal = this.route.snapshot.routeConfig?.path === 'game/test' || params.get('test') === '1';
      const requestedStatus = params.get('status') as LobbyStatus | null;
      this.roomStatus = requestedStatus === 'PLAYING' || requestedStatus === 'COMPLETED' || requestedStatus === 'RECENT' ? requestedStatus : 'WAITING';
      const requestedSort = params.get('sort') as GameRoomSort | null;
      this.roomCodeFilter = (params.get('roomCode') ?? '').trim().toUpperCase();
      this.roomCodeSearch = this.roomCodeFilter;
      this.roomSort = requestedSort === 'NEARLY_FULL' || requestedSort === 'NEWEST' || requestedSort === 'OPEN_SLOTS' ? requestedSort : 'RECOMMENDED';
      this.loadRooms(Math.max(1, Number(params.get('page')) || 1), false);
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
    this.errorTitle = '公開房間目前無法取得'; this.error = ''; this.selectedRoomId = ''; this.demoRoom = null;
    this.detailLoading = false;
    if (this.isDemo) {
      this.rooms = this.demoPage(page);
      return;
    }
    this.run(this.roomListRequest(page), (rooms) => (this.rooms = rooms));
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
    if (this.isDemo) {
      this.rooms = this.demoPage(page);
      this.syncDemoSelection();
      this.refreshing = false;
      this.changeDetector.markForCheck();
      return;
    }

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
    if (this.isDemo) {
      this.demoRoom = this.makeDemoDetail(room);
      return;
    }
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

  currentRoom(): GameRoomDetails | null { return this.demoRoom ?? this.game.currentRoom(); }
  canJoinSelectedRoom(): boolean {
    const room = this.currentRoom();
    return !!room && this.game.canJoinRoom(room);
  }
  clearSelection(): void {
    this.detailRequest?.unsubscribe();
    const roomId = this.selectedRoomId;
    this.selectedRoomId = ''; this.demoRoom = null; this.game.clearState();
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
    if (this.isDemo) {
      this.showCreateForm = false;
      this.errorTitle = this.isAdmin() ? '預覽模式' : '房間目前僅供查看';
      this.error = this.isAdmin()
        ? '目前是預覽模式，不能建立房間。你可以查看內容，或返回多人鑑定大廳。'
        : '這間房目前僅供查看，不能建立房間。請返回多人鑑定大廳。';
      return;
    }
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

  joinRoom(): void {
    const room = this.currentRoom(); if (!room) return;
    if (this.isRehearsal) {
      this.enterRoom(room.id);
      return;
    }
    if (this.isDemo) {
      this.errorTitle = this.isAdmin() ? '預覽模式' : '房間目前僅供查看';
      this.error = this.isAdmin()
        ? '目前是預覽模式，不能加入房間。你可以查看內容，或返回多人鑑定大廳。'
        : '這間房目前僅供查看，不能加入房間。請返回多人鑑定大廳。';
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

  private syncDemoSelection(): void {
    if (!this.selectedRoomId || !this.rooms) return;
    const room = this.rooms.items.find((item) => item.id === this.selectedRoomId);
    if (room) this.demoRoom = this.makeDemoDetail(room);
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

  private demoPage(page: number): ApiPage<GameRoomListItem> {
    const all = Array.from({ length: 120 }, (_, index): GameRoomListItem => {
      const maxPlayers = 4 + index % 4;
      const basePlayerCount = (index * 3 + 1) % 6 + 1;
      const liveAdjustment = this.demoRefreshCount > 0 && (index + this.demoRefreshCount) % 6 === 0 ? 1 : 0;
      const playerCount = Math.min(maxPlayers, basePlayerCount + liveAdjustment);
      const status: GameRoomListItem['status'] = index % 7 === 0 ? 'PLAYING' : index % 11 === 0 ? 'COMPLETED' : 'WAITING';
      const createdAt = new Date(Date.UTC(2026, 8, 10, 3, 0, 0) - index * 5 * 60_000).toISOString();
      return { id: `demo-${index + 1}`, roomCode: this.demoRoomCode(index), status, visibility: index % 9 === 0 ? 'PRIVATE' : 'PUBLIC', maxPlayers, totalRounds: index % 3 + 3, playerCount, categoryFilterCode: index % 2 ? 'CERAMIC' : 'PAINTING', eraBucketFilterCode: index % 2 ? 'QING' : 'MING', createdAt };
    }).filter((room) => (this.roomStatus === 'RECENT' ? room.status === 'COMPLETED' : room.status === this.roomStatus)
      && room.roomCode.toUpperCase().startsWith(this.roomCodeFilter))
      .sort((left, right) => this.compareDemoRooms(left, right));
    const totalPages = Math.max(1, Math.ceil(all.length / this.pageSize)); const safePage = Math.min(page, totalPages);
    return { items: all.slice((safePage - 1) * this.pageSize, safePage * this.pageSize), page: safePage, pageSize: this.pageSize, totalCount: all.length, totalPages };
  }

  private makeDemoDetail(room: GameRoomListItem): GameRoomDetails {
    return {
      ...room, answerSeconds: 90, votingSeconds: 60, categoryFilterCode: room.playerCount % 2 ? 'CERAMIC' : 'PAINTING', eraBucketFilterCode: room.playerCount % 2 ? 'QING' : 'MING', currentRoundNo: 0,
      currentRoundId: null,
      currentPlayerId: null,
      players: [],
      startedAt: null, endedAt: null
    };
  }

  private demoRoomCode(index: number): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let seed = Math.imul(index + 1, 0x9e3779b9);
    let code = '';
    for (let digit = 0; digit < 8; digit++) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      code += alphabet[(seed >>> 0) % alphabet.length];
    }
    return code;
  }

  private compareDemoRooms(left: GameRoomListItem, right: GameRoomListItem): number {
    const leftOpenSlots = left.maxPlayers - left.playerCount;
    const rightOpenSlots = right.maxPlayers - right.playerCount;
    const created = Date.parse(right.createdAt) - Date.parse(left.createdAt);
    if (this.roomSort === 'NEWEST') return created;
    if (this.roomSort === 'NEARLY_FULL') return leftOpenSlots - rightOpenSlots || created;
    if (this.roomSort === 'OPEN_SLOTS') return rightOpenSlots - leftOpenSlots || created;
    return right.playerCount - left.playerCount || leftOpenSlots - rightOpenSlots || created;
  }
}
