import { AfterViewInit, Component, computed, ElementRef, HostListener, ViewChild, input, output } from '@angular/core';
import { QRCodeComponent } from 'angularx-qrcode';

import { GameRoomListItem } from './game.models';

// integration: qrcode 是 angularx-qrcode 目前帶入的既有 CommonJS transit dependency；
// QR 只存在於 Game 房間的 lazy chunk，因此保留功能並在 angular.json 明確放行，
// 避免為了消除建置警告而引入新的 QR 套件或改動房間分享契約。
@Component({
  selector: 'app-game-room-qr-dialog',
  imports: [QRCodeComponent],
  templateUrl: './game-room-qr-dialog.component.html',
  styleUrl: './game-room-qr-dialog.component.scss'
})
export class GameRoomQrDialogComponent implements AfterViewInit {
  readonly room = input.required<Pick<GameRoomListItem, 'id' | 'roomCode'>>();
  readonly close = output<void>();
  readonly copy = output<string>();
  /** 掃描後會開啟大廳並自動找到這一桌，不用再手動輸入代號。 */
  readonly joinUrl = computed(() => `${location.origin}/game?code=${encodeURIComponent(this.room().roomCode)}`);

  @ViewChild('dialog') private dialog?: ElementRef<HTMLElement>;

  ngAfterViewInit(): void {
    this.dialog?.nativeElement.focus();
  }

  @HostListener('document:keydown.tab', ['$event'])
  keepFocus(event: Event): void {
    if (!(event instanceof KeyboardEvent)) return;
    const dialog = this.dialog?.nativeElement;
    if (!dialog) return;
    const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
    if (!buttons.length) { event.preventDefault(); dialog.focus(); return; }
    // QR 視窗置頂時，不讓鍵盤焦點落回底下的房間詳情。
    if (event.shiftKey && (document.activeElement === buttons[0] || document.activeElement === dialog)) {
      event.preventDefault(); buttons[buttons.length - 1].focus();
    } else if (!event.shiftKey && (document.activeElement === buttons[buttons.length - 1] || !dialog.contains(document.activeElement))) {
      event.preventDefault(); buttons[0].focus();
    }
  }

  copyRoomCode(): void {
    this.copy.emit(this.room().roomCode);
  }
}
