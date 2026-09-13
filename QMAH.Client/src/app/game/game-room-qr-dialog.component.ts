import { AfterViewInit, Component, ElementRef, ViewChild, input, output } from '@angular/core';
import { QRCodeComponent } from 'angularx-qrcode';

import { GameRoomListItem } from './game.models';

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
