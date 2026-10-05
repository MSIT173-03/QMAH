import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, input, output, signal } from '@angular/core';

import { AppreciationAnswer } from './game.models';

/** 投票／收回票的確認視窗：父層只負責開啟與接收「確認」。 */
@Component({
  selector: 'app-game-appreciation-confirm',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './game-appreciation-confirm.component.scss',
  template: `
    <dialog #dialog class="confirm-card" aria-labelledby="vote-confirm-title" aria-describedby="vote-confirm-description" (close)="target.set(null)">
      @if (target(); as answer) {
        <h3 id="vote-confirm-title">{{ answer.voted ? '要收回這張鑑賞票嗎？' : '要投這則回答一票嗎？' }}</h3>
        <p id="vote-confirm-description"><strong>{{ answer.author }}</strong> 寫的「{{ answer.artifactName }}」{{ answer.voted ? '，收回後票數會少一票，之後還可以重新投。' : '，每則回答只能投一票，之後也可以收回。' }}</p>
        <div class="confirm-actions"><button type="button" class="secondary" autofocus (click)="dialog.close()">先不要</button><button type="button" [disabled]="!!pending()" (click)="confirm(answer)">{{ answer.voted ? '收回鑑賞票' : '投下這一票' }}</button></div>
      }
    </dialog>
  `
})
export class GameAppreciationConfirmComponent {
  readonly pending = input('');
  readonly confirmed = output<AppreciationAnswer>();
  readonly target = signal<AppreciationAnswer | null>(null);
  @ViewChild('dialog') private dialog?: ElementRef<HTMLDialogElement>;

  open(answer: AppreciationAnswer): void {
    this.target.set(answer);
    this.dialog?.nativeElement.showModal();
    queueMicrotask(() => this.dialog?.nativeElement.querySelector<HTMLButtonElement>('button')?.focus());
  }

  confirm(answer: AppreciationAnswer): void {
    this.dialog?.nativeElement.close();
    this.target.set(null);
    this.confirmed.emit(answer);
  }
}
