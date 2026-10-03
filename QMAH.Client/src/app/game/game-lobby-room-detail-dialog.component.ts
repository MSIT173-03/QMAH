import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { GameRoomDetails, JoinGameRoomRequest } from './game.models';

@Component({
  selector: 'app-game-lobby-room-detail-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './game-lobby-room-detail-dialog.component.html',
  styleUrl: './game-lobby-room-detail-dialog.component.scss'
})
export class GameLobbyRoomDetailDialogComponent {
  readonly room = input<GameRoomDetails | null>(null);
  readonly detailLoading = input(false);
  readonly isDemo = input(false);
  readonly isAdmin = input(false);
  readonly isRehearsal = input(false);
  readonly canJoin = input(false);
  readonly joining = input(false);
  readonly joinForm = input.required<JoinGameRoomRequest>();

  readonly close = output<void>();
  readonly copyCode = output<string>();
  readonly showQr = output<Pick<GameRoomDetails, 'id' | 'roomCode'>>();
  readonly join = output<void>();

  @ViewChild('roomDialog') private roomDialog?: ElementRef<HTMLElement>;

  focusTarget(): HTMLElement | undefined { return this.roomDialog?.nativeElement; }
  get form(): JoinGameRoomRequest { return this.joinForm(); }
  openSlots(room: GameRoomDetails): number[] { return Array.from({ length: Math.max(0, room.maxPlayers - room.players.length) }, (_, index) => index); }
  statusText(status: GameRoomDetails['status']): string { return { WAITING: '等待中', PLAYING: '進行中', COMPLETED: '最近完成', CANCELLED: '已取消' }[status]; }
  playerStateText(player: GameRoomDetails['players'][number]): string { return player.role === 'HOST' ? '房主' : player.isReady ? '已準備' : '等待中'; }
  categoryText(code: string | null): string { return { CERAMIC: '陶瓷', JADE: '玉器', PAINTING: '書畫', METAL: '金屬' }[code?.toUpperCase() ?? ''] ?? code ?? '不限'; }
  eraText(code: string | null): string {
    // 年代名稱以資料庫 metadata 為主，保留日本江戶年代的 fallback。
    return { TANG: '唐代', SONG: '宋代', MING: '明代', QING: '清代', JAPAN_EDO: '日本江戶時代', MODERN: '近現代' }[code?.toUpperCase() ?? ''] ?? code ?? '不限';
  }
}
