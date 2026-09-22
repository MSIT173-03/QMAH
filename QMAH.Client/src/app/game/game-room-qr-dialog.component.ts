import { AfterViewInit, Component, ElementRef, ViewChild, input, output } from '@angular/core';
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

  @ViewChild('dialog') private dialog?: ElementRef<HTMLElement>;

  ngAfterViewInit(): void {
    this.dialog?.nativeElement.focus();
  }

  copyRoomCode(): void {
    this.copy.emit(this.room().roomCode);
  }
}
