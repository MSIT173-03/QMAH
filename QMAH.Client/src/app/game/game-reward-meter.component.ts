import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { GameDailyRewardStatus } from './game.models';
import { GameService } from './game.service';

@Component({
  selector: 'app-game-reward-meter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './game-reward-meter.component.scss',
  template: `
    @if (status(); as current) {
      <section class="reward-meter" aria-label="每日遊戲點數">
        <div class="meter-heading"><strong>今日遊戲點數</strong><span aria-live="polite">{{ current.earned }}／{{ current.dailyLimit }} 點</span></div>
        <div class="meter-track" role="progressbar" aria-label="今日已獲得遊戲點數" aria-valuemin="0" [attr.aria-valuemax]="current.dailyLimit" [attr.aria-valuenow]="Math.min(current.dailyLimit, current.earned)"><span [style.width.%]="Math.min(100, current.earned / current.dailyLimit * 100)"></span></div>
        <p>{{ current.remaining > 0 ? '今天還可獲得 ' + current.remaining + ' 點。' : '今日點數已滿，仍可遊玩並取得鑰匙獎勵。' }}</p>
        @if (current.breakthroughUnlocked) {
          <p>今日已突破，上限增加 {{ current.bonusLimit }} 點。</p>
        } @else {
          <div class="breakthrough-action"><span>單人達標 {{ Math.min(3, current.completedModes) }}／3 種 · 多人 {{ current.hasCompletedMultiplayer ? '已完成' : '尚未完成' }}</span><button type="button" (click)="unlock()" [disabled]="busy() || !current.canBreakthrough">{{ busy() ? '解鎖中…' : '突破上限 ＋' + current.bonusLimit + ' 點' }}</button></div>
        }
        <details>
          <summary>點數與突破規則</summary>
          <p>單人與多人共用每日上限。每天台灣時間 00:00 更新。</p>
          <p>鑰匙與鑰匙進度不受點數上限影響。</p>
          <p>當天完成一場多人遊戲，或三種不同單人玩法各達 B 級以上，可突破一次。</p>
          <p>突破後可再獲得最多 {{ current.bonusLimit }} 點，仍須遊玩取得。</p>
        </details>
        <details>
          <summary>圖鑑與鑰匙獎勵</summary>
          <p>圖鑑已收集 {{ current.collectedArtifacts }}／{{ current.totalArtifacts }} 件。</p>
          <p>{{ current.keyRewardDivisor === 4 ? '圖鑑已收齊。遊戲鑰匙獎勵以原本的四分之一累積。' : current.keyRewardDivisor === 2 ? '圖鑑已收集至少 80%。遊戲鑰匙獎勵以原本的一半累積。' : '目前維持完整鑰匙獎勵。圖鑑收集達 80% 後減半，全部收齊後為四分之一。' }}</p>
          <p>不足一把的獎勵會存成鑰匙進度，小數也會保留。新增可收集文物後，會重新計算完成度。</p>
        </details>
        @if (error()) { <p role="alert">{{ error() }}</p> }
      </section>
    } @else if (error()) { <p role="status">今日點數進度暫時無法讀取。<button type="button" (click)="load()">重新讀取</button></p> }
  `
})
export class GameRewardMeterComponent {
  readonly refreshToken = input<unknown>(null);
  readonly Math = Math;
  readonly status = signal<GameDailyRewardStatus | null>(null);
  readonly error = signal('');
  readonly busy = signal(false);
  private readonly game = inject(GameService);
  private readonly destroyRef = inject(DestroyRef);
  constructor() { effect(() => { this.refreshToken(); this.load(); }); }
  load(): void {
    this.game.getMiniGameRewardStatus().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: status => { this.status.set(status); this.error.set(''); },
      error: () => this.error.set('請稍後重新讀取。')
    });
  }
  unlock(): void {
    if (this.busy() || !this.status()?.canBreakthrough) return;
    this.busy.set(true);
    this.game.unlockDailyRewardBreakthrough().pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false))).subscribe({
      next: status => { this.status.set(status); this.error.set(''); },
      error: () => this.error.set('突破尚未完成，請再試一次。')
    });
  }
}
