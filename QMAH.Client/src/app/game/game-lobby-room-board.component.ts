import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiPage, GameRoomFilterStatus, GameRoomListItem, GameRoomSort } from './game.models';
import { QmahIconComponent } from '../shared/components/qmah-icon/qmah-icon';

type LobbyStatus = GameRoomFilterStatus | 'RECENT';

@Component({
  selector: 'app-game-lobby-room-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, QmahIconComponent],
  templateUrl: './game-lobby-room-board.component.html',
  styleUrl: './game-lobby-room-board.component.scss'
})
export class GameLobbyRoomBoardComponent {
  readonly isDemo = input(false);
  readonly isRehearsal = input(false);
  readonly isAdmin = input(false);
  readonly roomStatus = input<LobbyStatus>('WAITING');
  readonly roomSort = input<GameRoomSort>('RECOMMENDED');
  readonly roomCodeFilter = input('');
  readonly rooms = input<ApiPage<GameRoomListItem> | null>(null);
  readonly loading = input(false);
  readonly refreshing = input(false);
  readonly error = input('');
  readonly errorTitle = input('公開房間目前無法取得');
  readonly selectedRoomId = input('');
  readonly roomCodeSearch = model('');

  readonly search = output<void>();
  readonly clearRoomCode = output<void>();
  readonly statusSelected = output<LobbyStatus>();
  readonly sortSelected = output<GameRoomSort>();
  readonly refresh = output<void>();
  readonly pageSelected = output<number>();
  readonly createRoom = output<void>();
  readonly retry = output<void>();
  readonly roomSelected = output<GameRoomListItem>();

  readonly loadingRows = [1, 2, 3, 4, 5];

  isRoomStatusActive(status: LobbyStatus): boolean { return this.roomStatus() === status; }
  occupancy(room: GameRoomListItem): number { return Math.round((room.playerCount / room.maxPlayers) * 100); }
  statusText(status: GameRoomListItem['status']): string { return { WAITING: '等待中', PLAYING: '進行中', COMPLETED: '最近完成', CANCELLED: '已取消' }[status]; }
  categoryText(code: string | null): string {
    return { CERAMIC: '陶瓷', JADE: '玉器', PAINTING: '書畫', METAL: '金屬' }[code?.toUpperCase() ?? ''] ?? code ?? '不限';
  }
  eraText(code: string | null): string {
    // 年代名稱以資料庫 metadata 為主，保留日本江戶年代的 fallback。
    return { TANG: '唐代', SONG: '宋代', MING: '明代', QING: '清代', JAPAN_EDO: '日本江戶時代', MODERN: '近現代' }[code?.toUpperCase() ?? ''] ?? code ?? '不限';
  }
  pageNumbers(): number[] {
    const rooms = this.rooms();
    if (!rooms) return [];
    const start = Math.max(1, Math.min(rooms.page - 1, rooms.totalPages - 2));
    return Array.from({ length: Math.min(3, rooms.totalPages) }, (_, index) => start + index);
  }
}
