import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, input, model, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MiniGameStart } from './game.models';

/** 單人遊戲的暫停選單：暫停、求救、確認離開三個畫面；狀態與動作由父層決定。 */
@Component({
  selector: 'app-game-training-pause',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './game-training-pause.component.scss',
  template: `
      <dialog #dialog class="pause-dialog" aria-labelledby="pause-title" (close)="closed.emit()">
        <header class="pause-head">
          <div><h2 id="pause-title">{{ confirmLeaving() ? '離開本局？' : helpRequested() ? '需要幫忙嗎？' : '遊戲暫停' }}</h2>@if (!confirmLeaving() && !helpRequested()) { <p>{{ attempt()?.modeName }} · 已用時間 {{ elapsedLabel() }}，暫停中不計時</p> }</div>
        </header>
        @if (confirmLeaving()) {
          <p class="pause-note">離開後會清除本局進度，不會結算成績或發放獎勵。</p>
          <div class="pause-menu">
            <button type="button" data-button-tone="start" (click)="resume.emit()">繼續本局</button>
            <button type="button" data-button-tone="danger" (click)="leave.emit()">放棄本局，回玩法列表</button>
          </div>
        } @else if (helpRequested()) {
          <div class="help-options">
            <section class="help-option" aria-labelledby="hint-option-title">
              <h3 id="hint-option-title">提示後繼續</h3>
              <p>{{ attempt()?.modeCode === 'DETAIL_LOCATOR' ? '標示目前細節所在的原圖區域，再由你指出位置。' : attempt()?.modeCode === 'MEMORY_MATCH' ? '告訴你一組配對的位置，再由你翻牌完成。' : '標示一片碎片在原圖中的區域，再由你放到正確格子。' }}{{ attempt()?.modeCode === 'MEMORY_MATCH' ? '首次查看一組配對扣' : '每次提示扣' }} <span class="text-unit">{{ hintPenalty() }} 分</span>。</p>
              <button type="button" (click)="help.emit(false)" [disabled]="!canRequestHint()">取得提示並繼續</button>
            </section>
            <section class="help-option" aria-labelledby="auto-option-title">
              <h3 id="auto-option-title">協助完成</h3>
              <p>協助完成剩餘內容，扣 <span class="text-unit">{{ helpPenalty() }} 分</span>，本局最高 <span class="text-unit">B 級</span>。完成後不會自動送出，可以自己選擇查看結算。</p>
              <button type="button" data-button-tone="danger" (click)="help.emit(true)" [disabled]="!canAskForHelp()">確認協助完成</button>
            </section>
          </div>
          <p class="pause-note">扣分只影響本局，不會減少帳戶裡的鑑定點數。送出失敗時，進度與協助紀錄都會保留。</p>
          <div class="pause-menu"><button type="button" data-button-tone="neutral" (click)="helpRequested.set(false)">返回暫停選單</button></div>
        } @else {
          <div class="pause-menu">
            <button type="button" class="pause-resume" data-button-tone="start" (click)="resume.emit()">繼續遊玩</button>
            <div class="pause-pair">
              <a routerLink="/game" class="pause-lobby" data-button-tone="neutral">保留進度回大廳</a>
            </div>
            <button type="button" class="pause-quit" data-button-tone="danger" (click)="leave.emit()">放棄本局</button>
          </div>
          <p class="pause-note">回大廳會保留本局，可以回來繼續。放棄則清除進度，不結算成績或獎勵。</p>
        }
      </dialog>
  `
})
export class GameTrainingPauseComponent {
  readonly attempt = input<MiniGameStart | null>(null);
  readonly elapsedLabel = input('');
  readonly confirmLeaving = input(false);
  readonly helpRequested = model(false);
  readonly canRequestHint = input(false);
  readonly canAskForHelp = input(false);
  readonly hintPenalty = input(0);
  readonly helpPenalty = input(0);
  readonly resume = output<void>();
  readonly leave = output<void>();
  readonly help = output<boolean>();
  readonly closed = output<void>();
  @ViewChild('dialog') private dialog?: ElementRef<HTMLDialogElement>;

  /** 讓父層沿用原本對 <dialog> 的操作：showModal()、close()、查詢是否開啟。 */
  get nativeElement(): HTMLDialogElement { return this.dialog!.nativeElement; }
}
