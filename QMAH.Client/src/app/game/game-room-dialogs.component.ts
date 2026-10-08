import { Component, ElementRef, ViewChild, input } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { GameAudioToggleComponent } from './game-audio-toggle.component';
import type { GameRoomComponent } from './game-room.component';

/**
 * 牌桌的對話框：牌桌選單、席位、牌背、文物大圖、作答、離開確認。
 * 狀態與動作都在牌桌元件裡，這裡只負責畫面與樣式，所以直接綁定牌桌元件本身。
 */
@Component({
  selector: 'app-game-room-dialogs',
  imports: [FormsModule, GameAudioToggleComponent],
  styleUrl: './game-room-dialogs.component.scss',
  template: `
    @let h = host();
  <dialog class="table-dialog menu-dialog" data-panel="settings" aria-labelledby="settings-title">
    <header><h2 id="settings-title">牌桌選單</h2><button type="button" class="dlg-close" (click)="h.closeRoomPanel('settings')" aria-label="關閉牌桌選單"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button></header>
    @if (h.room) {
      <div class="menu-code">
        <div><small>房間代號</small><code>{{ h.room.roomCode }}</code></div>
        <button type="button" class="tone-blue" (click)="h.closeRoomPanel('settings'); h.qrOpen = true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v3M14 20h3M20 20h1" /></svg>分享 QR 碼</button>
      </div>
      <dl class="menu-facts">
        <div><dt>回合數</dt><dd>{{ h.room.totalRounds }} 回合</dd></div>
        <div><dt>房間類型</dt><dd>{{ h.room.visibility === 'PRIVATE' ? '私人房間' : '公開房間' }}</dd></div>
        <div><dt>作答時間</dt><dd>{{ h.room.answerSeconds / 60 }} 分鐘</dd></div>
        <div><dt>投票時間</dt><dd>{{ h.room.votingSeconds / 60 }} 分鐘</dd></div>
      </dl>
    }
    <ul class="menu-notes">
      <li><i aria-hidden="true">i</i>聊天只留在這張牌桌，玩家全部離線並逾時後就會清除。</li>
      @if (h.testMode) { <li><i aria-hidden="true">i</i>測試模式不會新增正式回合、點數或鑰匙。</li> }
    </ul>
    <app-game-audio-toggle [inline]="true" />
    <div class="menu-leave"><button type="button" data-button-tone="danger" (click)="h.closeRoomPanel('settings'); h.requestLeaveRoom()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>{{ h.isSpectator ? '離開觀戰' : '離開房間' }}</button></div>
  </dialog>
  <dialog class="table-dialog" data-panel="seat" aria-labelledby="seat-title"><header><h2 id="seat-title">玩家席位</h2><button type="button" (click)="h.closeRoomPanel('seat')">關閉</button></header>@if (h.selectedSeat(); as player) { <h3>{{ player.displayName }}</h3><p>第 {{ player.seatNo }} 席 · {{ player.role === 'HOST' ? '房主' : '玩家' }}</p><p>{{ player.connectionStatus === 'ONLINE' ? '目前在線' : '離線' }}</p>@if (player.id === h.currentPlayerId && h.room?.status === 'WAITING') { <button type="button" (click)="h.closeRoomPanel('seat'); h.openRoomPanel('colors')">更換我的牌背</button> } }</dialog>
  <dialog class="table-dialog colors-dialog" data-panel="colors" aria-labelledby="colors-title">
    <header><div><h2 id="colors-title">選擇牌背</h2><p>開始遊戲後，本局的牌背顏色就會固定。</p></div><button type="button" class="dlg-close" (click)="h.closeRoomPanel('colors')" aria-label="關閉牌背選擇"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button></header>
    <div class="color-grid">@for (color of h.cardColors; track color) { <button type="button" class="swatch" [attr.data-color]="color" [attr.data-state]="h.playerColors[h.currentPlayerId] === color ? 'mine' : h.isCardColorTaken(color) ? 'taken' : 'free'" [style.--seat-color]="h.colorHex(color)" [attr.aria-label]="h.cardColorNames[color] + '牌背' + (h.isCardColorTaken(color) ? '，已有玩家使用' : '')" [attr.aria-pressed]="h.playerColors[h.currentPlayerId] === color" [disabled]="h.colorBusy || h.isCardColorTaken(color)" (click)="h.chooseCardColor(color)"><span class="seat-back color-preview" aria-hidden="true"></span><span class="swatch-name">{{ h.cardColorNames[color] }}</span>@if (h.playerColors[h.currentPlayerId] === color) { <span class="swatch-badge">使用中</span> } @else if (h.isCardColorTaken(color)) { <span class="swatch-badge is-taken">已被選走</span> }</button> }</div>
  </dialog>
  <dialog class="table-dialog artifact-dialog" data-panel="artifact" aria-labelledby="artifact-title"><header><h2 id="artifact-title">{{ h.round?.artifactName }}</h2><button type="button" (click)="h.closeRoomPanel('artifact')">關閉</button></header>@if (h.round) { @if (!h.artifactImageUnavailable && (h.round.primaryImagePath || h.round.thumbnailPath)) { <img [src]="h.round.primaryImagePath || h.round.thumbnailPath" [alt]="h.round.artifactName" (error)="h.artifactImageUnavailable = true" /> } @else { <p>這件文物的圖片暫時無法顯示</p> } }</dialog>
  <dialog class="table-dialog answer-dialog" data-panel="answer" aria-labelledby="answer-title"><header><h2 id="answer-title">你的回答</h2><button type="button" (click)="h.closeRoomPanel('answer')">先收起</button></header><form (ngSubmit)="h.submitAnswer()">@if (h.actionError) { <p class="answer-error" role="alert">送出失敗，內容仍保留。{{ h.actionError }}</p> }<fieldset class="answer-types"><legend>回答方式</legend><div>@for (type of h.answerTypes; track type.value) { <button type="button" [attr.aria-pressed]="h.answerType === type.value" [class.is-selected]="h.answerType === type.value" (click)="h.answerType = type.value">{{ type.label }}</button> }</div></fieldset><p>{{ h.answerTypes[0].value === h.answerType ? h.answerTypes[0].hint : h.answerTypes[1].value === h.answerType ? h.answerTypes[1].hint : h.answerTypes[2].hint }}</p><p>每回合只能送出一次，送出後不能修改。先收起視窗會保留草稿。</p><label for="answer-text">寫下你的說法</label><textarea id="answer-text" name="h.answerText" [(ngModel)]="h.answerText" (ngModelChange)="h.saveDraft($event)" maxlength="500" required rows="7" placeholder="從文物上的細節開始寫…"></textarea><div class="answer-foot"><span>{{ h.answerText.length }}／500</span><button type="submit" data-button-tone="start" [disabled]="h.submittingAnswer || !h.answerText.trim()">{{ h.submittingAnswer ? '送出中…' : '送出回答' }}</button></div></form></dialog>
  @if (h.showLeaveConfirm) {
    <div class="leave-dialog-backdrop" role="presentation" (click)="h.cancelLeaveRoom()">
      <section #leaveDialog class="leave-dialog" role="dialog" aria-modal="true" aria-labelledby="leave-dialog-title" tabindex="-1" (click)="$event.stopPropagation()">
        <span class="leave-icon" aria-hidden="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg></span>
        <h2 id="leave-dialog-title">要離開牌桌嗎？</h2>
        <p>離開後會釋出你的座位。遊戲開始後，無法重新加入這一場。</p>
        <div class="leave-actions">
          <button type="button" data-button-tone="neutral" (click)="h.cancelLeaveRoom()">留在牌桌</button>
          <button type="button" data-button-tone="danger" (click)="h.leaveRoom()" [disabled]="h.leaving">{{ h.leaving ? '離開中…' : '離開房間' }}</button>
        </div>
      </section>
    </div>
  }

  `
})
export class GameRoomDialogsComponent {
  readonly host = input.required<GameRoomComponent>();
  @ViewChild('leaveDialog') leaveDialog?: ElementRef<HTMLElement>;
}
