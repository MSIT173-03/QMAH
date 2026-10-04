import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, ViewChild, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { GameDailyRewardStatus } from './game.models';
import { GameService } from './game.service';

let rewardMeterSequence = 0;

@Component({
  selector: 'app-game-reward-meter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './game-reward-meter.component.scss',
  template: `
    @if (status(); as current) {
      <section class="reward-meter" [class.is-open]="detailsOpen()">
        <button #meterHeading type="button" class="meter-heading" [attr.popovertarget]="detailsId" [attr.aria-expanded]="detailsOpen()" [attr.aria-controls]="detailsId"><strong>今日遊戲點數</strong><span aria-live="polite">{{ current.earned }}／{{ current.dailyLimit }} 點</span><span class="meter-toggle">{{ current.canBreakthrough ? '可突破上限' : '獎勵詳情' }}</span><span class="meter-track" role="progressbar" aria-label="今日已獲得遊戲點數" aria-valuemin="0" [attr.aria-valuemax]="current.dailyLimit" [attr.aria-valuenow]="Math.min(current.dailyLimit, current.earned)"><span class="meter-fill" [style.--meter-progress]="progressPercent(current) + '%'" aria-hidden="true"></span></span></button>
        <div #rewardDetails class="reward-details" [id]="detailsId" popover="auto" (toggle)="onDetailsToggle($event)" aria-label="獎勵詳情">
        <header class="reward-details-heading"><h2>今日獎勵進度</h2><button type="button" class="reward-details-close" [attr.popovertarget]="detailsId" popovertargetaction="hide" aria-label="關閉獎勵詳情"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></header>
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
        </div>
      </section>
    } @else if (error()) { <p role="status">今日點數進度暫時無法讀取。<button type="button" (click)="load()">重新讀取</button></p> }
  `
})
export class GameRewardMeterComponent {
  readonly detailsId = `game-reward-details-${++rewardMeterSequence}`;
  readonly detailsOpen = signal(false);
  @ViewChild('meterHeading') private meterHeading?: ElementRef<HTMLButtonElement>;
  @ViewChild('rewardDetails') private rewardDetails?: ElementRef<HTMLElement>;
  readonly refreshToken = input<unknown>(null);
  readonly Math = Math;
  readonly status = signal<GameDailyRewardStatus | null>(null);
  readonly error = signal('');
  readonly busy = signal(false);
  private readonly game = inject(GameService);
  private readonly destroyRef = inject(DestroyRef);
  constructor() { effect(() => { this.refreshToken(); this.load(); }); }
  onDetailsToggle(event: Event): void {
    this.detailsOpen.set((event as ToggleEvent).newState === 'open');
    if (this.detailsOpen()) requestAnimationFrame(() => this.positionDetails());
  }
  @HostListener('window:resize')
  @HostListener('window:scroll')
  positionDetails(): void {
    const heading = this.meterHeading?.nativeElement;
    const panel = this.rewardDetails?.nativeElement;
    if (!heading || !panel || !this.detailsOpen()) return;
    const rect = heading.getBoundingClientRect();
    const width = Math.min(500, window.innerWidth - 32);
    panel.style.setProperty('--reward-popover-width', `${width}px`);
    const height = Math.min(panel.scrollHeight, window.innerHeight * .65, 520);
    const below = window.innerHeight - rect.bottom - 16;
    const top = below >= height ? rect.bottom + 8 : Math.max(16, rect.top - height - 8);
    panel.style.setProperty('--reward-popover-left', `${Math.max(16, Math.min(rect.right - width, window.innerWidth - width - 16))}px`);
    panel.style.setProperty('--reward-popover-top', `${Math.min(top, window.innerHeight - height - 16)}px`);
  }
  progressPercent(current: GameDailyRewardStatus): number {
    return current.dailyLimit > 0 ? Math.max(0, Math.min(100, current.earned / current.dailyLimit * 100)) : 0;
  }
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
