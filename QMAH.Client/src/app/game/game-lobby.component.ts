import { ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, Subscription, finalize } from 'rxjs';

import { ApiPage, CreateGameRoomRequest, GameRoomDetails, GameRoomFilterStatus, GameRoomListItem, GameRoomSort, JoinGameRoomRequest } from './game.models';
import { GameRoomQrDialogComponent } from './game-room-qr-dialog.component';
import { GameService } from './game.service';

type LobbyStatus = GameRoomFilterStatus | 'RECENT';

@Component({
  selector: 'app-game-lobby',
  imports: [FormsModule, RouterLink, GameRoomQrDialogComponent],
  templateUrl: './game-lobby.component.html',
  styleUrl: './game-lobby.component.scss'
})
export class GameLobbyComponent implements OnInit, OnDestroy {
  readonly game = inject(GameService);
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
  loading = false;
  detailLoading = false;
  creating = false;
  joining = false;
  showCreateForm = false;
  showFilter = false;
  error = '';
  success = '';
  errorTitle = '公開房間目前無法取得';
  readonly loadingRows = [1, 2, 3, 4, 5];
  readonly pageSize = 20;
  isDemo = false;
  qrRoom: Pick<GameRoomListItem, 'id' | 'roomCode'> | null = null;
  @ViewChild('createDialog') private createDialog?: ElementRef<HTMLElement>;

  ngOnInit(): void {
    this.routeSubscription = this.route.queryParamMap.subscribe((params) => {
      this.isDemo = this.route.snapshot.routeConfig?.path === 'game/demo';
      const requestedStatus = params.get('status') as LobbyStatus | null;
      this.roomStatus = requestedStatus === 'PLAYING' || requestedStatus === 'COMPLETED' || requestedStatus === 'RECENT' ? requestedStatus : 'WAITING';
      const requestedSort = params.get('sort') as GameRoomSort | null;
      this.roomSort = requestedSort === 'NEARLY_FULL' || requestedSort === 'NEWEST' || requestedSort === 'OPEN_SLOTS' ? requestedSort : 'RECOMMENDED';
      this.loadRooms(Math.max(1, Number(params.get('page')) || 1), false);
    });
  }

  ngOnDestroy(): void { this.routeSubscription?.unsubscribe(); }

  loadRooms(page = 1, syncUrl = true): void {
    if (syncUrl) {
      this.router.navigate([], { relativeTo: this.route, queryParams: { status: this.roomStatus === 'WAITING' ? null : this.roomStatus, sort: this.roomSort === 'RECOMMENDED' ? null : this.roomSort, page: page === 1 ? null : page } });
      return;
    }
    this.errorTitle = '公開房間目前無法取得'; this.error = ''; this.selectedRoomId = ''; this.demoRoom = null;
    if (this.isDemo) {
      this.rooms = this.demoPage(page);
      const initialRoom = this.rooms.items[0];
      if (initialRoom) {
        this.selectedRoomId = initialRoom.id;
        this.demoRoom = this.makeDemoDetail(initialRoom);
      }
      return;
    }
    const status = this.roomStatus === 'RECENT' ? 'COMPLETED' : this.roomStatus;
    this.run(this.game.getRooms({ status, sort: this.roomSort, page, pageSize: this.pageSize }), (rooms) => (this.rooms = rooms));
  }

  setRoomStatus(status: LobbyStatus): void {
    if (this.roomStatus === status) return;
    this.roomStatus = status; this.showFilter = false; this.game.clearState(); this.loadRooms();
  }

  isRoomStatusActive(status: LobbyStatus): boolean { return this.roomStatus === status; }

  setRoomSort(sort: GameRoomSort): void {
    if (this.roomSort === sort) return;
    this.roomSort = sort;
    this.loadRooms(1);
  }

  selectRoom(room: GameRoomListItem): void {
    this.selectedRoomId = room.id; this.errorTitle = '目前無法載入房間資訊'; this.success = ''; this.error = '';
    if (this.isDemo) {
      this.demoRoom = this.makeDemoDetail(room);
      this.revealMobileDetails();
      return;
    }
    this.game.clearState(); this.detailLoading = true;
    this.game.getRoom(room.id).pipe(finalize(() => {
      this.detailLoading = false;
      this.changeDetector.markForCheck();
    })).subscribe({
      next: () => {
        this.revealMobileDetails();
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.error = this.game.errorMessage(error);
        this.changeDetector.markForCheck();
      }
    });
  }

  currentRoom(): GameRoomDetails | null { return this.demoRoom ?? this.game.currentRoom(); }
  clearSelection(): void { this.selectedRoomId = ''; this.demoRoom = null; this.game.clearState(); }
  toggleCreateForm(): void {
    this.showCreateForm = !this.showCreateForm;
    if (this.showCreateForm) {
      this.success = '';
      this.focusDialog(() => this.createDialog);
    }
  }

  createRoom(): void {
    if (this.isDemo) {
      this.showCreateForm = false;
      this.errorTitle = 'Demo 預覽模式';
      this.error = '這些是預覽房間，無法建立或加入。請返回多人房間大廳。';
      return;
    }
    this.creating = true; this.errorTitle = '房間建立失敗'; this.error = ''; this.success = '';
    this.game.createRoom(this.createForm).pipe(finalize(() => {
      this.creating = false;
      this.changeDetector.markForCheck();
    })).subscribe({
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
    if (this.isDemo) {
      this.errorTitle = 'Demo 預覽模式';
      this.error = '這些是預覽房間，無法加入。請返回多人房間大廳。';
      return;
    }
    this.joining = true; this.errorTitle = '加入房間失敗'; this.error = ''; this.success = '';
    this.game.joinRoom(room.id, this.joinForm).pipe(finalize(() => {
      this.joining = false;
      this.changeDetector.markForCheck();
    })).subscribe({
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
    void this.router.navigate(['/game/room', roomId]);
  }

  private showRoomActionError(error: unknown, fallbackTitle: string): void {
    if (error instanceof HttpErrorResponse && error.status === 401) {
      this.errorTitle = '請先登入';
      this.error = '請先登入會員，再建立或加入房間。';
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
    this.qrRoom = room;
    this.error = '';
  }

  closeRoomQr(): void { this.qrRoom = null; }

  @HostListener('document:keydown.escape')
  closeTransientPanel(): void {
    if (this.qrRoom) { this.closeRoomQr(); return; }
    if (this.showCreateForm) { this.showCreateForm = false; return; }
    if (this.showFilter) this.showFilter = false;
  }

  openSlots(room: { players: unknown[]; maxPlayers: number }): number[] { return Array.from({ length: Math.max(0, room.maxPlayers - room.players.length) }, (_, index) => index); }
  occupancy(room: GameRoomListItem): number { return Math.round((room.playerCount / room.maxPlayers) * 100); }
  statusText(status: GameRoomListItem['status']): string { return { WAITING: '等待中', PLAYING: '進行中', COMPLETED: '最近完成', CANCELLED: '已取消' }[status]; }
  roomListDescription(): string {
    const subject = this.roomStatus === 'PLAYING'
      ? '正在進行的房間'
      : this.roomStatus === 'RECENT'
        ? '最近完成的房間'
        : '目前可加入的房間';
    return `${subject}，${this.roomSortText()}排列`;
  }
  roomSortText(): string { return { RECOMMENDED: '推薦', NEARLY_FULL: '快滿', NEWEST: '最新', OPEN_SLOTS: '空位最多' }[this.roomSort]; }
  playerStateText(player: GameRoomDetails['players'][number]): string {
    return player.role === 'HOST' ? '房主' : player.isReady ? '已準備' : '等待中';
  }
  categoryText(code: string | null): string {
    return { CERAMIC: '陶瓷', JADE: '玉器', PAINTING: '書畫', METAL: '金屬' }[code?.toUpperCase() ?? ''] ?? code ?? '不限';
  }
  eraText(code: string | null): string {
    return { TANG: '唐代', SONG: '宋代', MING: '明代', QING: '清代', MODERN: '近現代' }[code?.toUpperCase() ?? ''] ?? code ?? '不限';
  }
  pageNumbers(): number[] { if (!this.rooms) return []; const start = Math.max(1, Math.min(this.rooms.page - 1, this.rooms.totalPages - 2)); return Array.from({ length: Math.min(3, this.rooms.totalPages) }, (_, index) => start + index); }

  private run<T>(request: Observable<T>, assign: (value: T) => void): void {
    this.loading = true;
    request.pipe(finalize(() => {
      this.loading = false;
      this.changeDetector.markForCheck();
    })).subscribe({
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

  private focusDialog(getDialog: () => ElementRef<HTMLElement> | undefined): void {
    setTimeout(() => getDialog()?.nativeElement.focus(), 0);
  }

  private revealMobileDetails(): void {
    setTimeout(() => document.querySelector<HTMLElement>('.notes-page')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0);
  }

  private demoPage(page: number): ApiPage<GameRoomListItem> {
    const all = Array.from({ length: 120 }, (_, index): GameRoomListItem => {
      const playerCount = (index * 3 + 1) % 6 + 1;
      const status: GameRoomListItem['status'] = index % 7 === 0 ? 'PLAYING' : index % 11 === 0 ? 'COMPLETED' : 'WAITING';
      const createdAt = new Date(Date.UTC(2026, 8, 10, 3, 0, 0) - index * 5 * 60_000).toISOString();
      return { id: `demo-${index + 1}`, roomCode: this.demoRoomCode(index), status, visibility: index % 9 === 0 ? 'PRIVATE' : 'PUBLIC', maxPlayers: 4 + index % 4, totalRounds: index % 3 + 3, playerCount, categoryFilterCode: index % 2 ? 'CERAMIC' : 'PAINTING', eraBucketFilterCode: index % 2 ? 'QING' : 'MING', createdAt };
    }).filter((room) => this.roomStatus === 'RECENT' ? room.status === 'COMPLETED' : room.status === this.roomStatus)
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
