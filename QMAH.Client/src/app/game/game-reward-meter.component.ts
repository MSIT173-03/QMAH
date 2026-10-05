import { QmahIconComponent } from '../shared/components/qmah-icon/qmah-icon';
import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { GameDailyRewardStatus } from './game.models';
import { GameMeterRowComponent, MeterRow } from './game-meter-row.component';
import { KeyService } from '../services/key-service';
import { GameService } from './game.service';

let rewardMeterSequence = 0;

@Component({
  selector: 'app-game-reward-meter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './game-reward-meter.component.scss',
  imports: [GameMeterRowComponent, QmahIconComponent],
  template: `
    @if (status(); as current) {
      <section class="reward-meter" [class.is-open]="detailsOpen()" [class.is-compact]="variant() === 'compact'" [class.is-frozen]="frozen()">
        <button type="button" class="meter-heading" [attr.title]="frozen() ? '測試模式：點數與鑰匙進度已凍結' : null" [attr.popovertarget]="detailsId" [attr.aria-expanded]="detailsOpen()" [attr.aria-controls]="detailsId">
          @if (variant() === 'compact') {
            @if (frozen()) { <svg class="mini-frost" viewBox="0 0 24 24" aria-label="測試模式，進度已凍結"><path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 2 3-2M9 20l3-2 3 2" /></svg> }
            <span class="mini" data-tone="points"><app-qmah-icon class="meter-icon" name="coins" aria-hidden="true" /><span class="mini-label">鑑定點數</span><span class="mini-bar"><span [class.is-gaining]="gain() > 0" [style.--from.%]="basePercent(current)" [style.width.%]="progressPercent(current)"></span></span><b><span class="count" [class.is-gaining]="gain() > 0" [style.--from]="Math.round(current.earned - gain())" [style.--to]="Math.round(current.earned)"></span><span class="mini-max">／{{ current.dailyLimit }}</span></b></span>
            @if (keys(); as k) { <span class="mini" data-tone="keys"><app-qmah-icon class="meter-icon" name="key-round" aria-hidden="true" /><span class="mini-label">鑰匙</span><span class="mini-bar"><span [class.is-gaining]="keyGain() > 0" [style.--from.%]="keyBase(k)" [style.width.%]="keyTotal(k)"></span></span><b><span class="count" [class.is-gaining]="keyGain() > 0" [style.--from]="Math.round(k.balance - keyGain())" [style.--to]="Math.round(k.balance)"></span><span class="mini-max">／{{ k.threshold }}</span></b></span> }
            <span class="mini-chevron" aria-hidden="true"></span>
            <span class="visually-hidden">獎勵詳情</span>
          } @else {
          <span class="meter-rows" aria-live="polite">
            <app-game-meter-row [row]="pointsRow(current, '今日鑑定點數獲得上限')" />
            @if (keys(); as k) {
              <app-game-meter-row [row]="keysRow(k)" />
            }
          </span>
          <span class="meter-toggle">{{ current.canBreakthrough ? '可突破上限' : '獎勵詳情' }}</span>
          }
        </button>
        <div class="reward-details" [id]="detailsId" popover="auto" (toggle)="onDetailsToggle($event)" aria-label="獎勵詳情">
          <header class="rd-head"><h2>今日獎勵進度</h2><button type="button" class="rd-close" [attr.popovertarget]="detailsId" popovertargetaction="hide" aria-label="關閉獎勵詳情"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></header>
          @if (frozen()) { <p class="rd-frozen">測試模式中，點數與鑰匙進度已凍結，不會增減。</p> }
          <section class="rd-section">
            <app-game-meter-row [row]="pointsRow(current, '鑑定點數')" />
            <p>{{ current.remaining > 0 ? '今天還可獲得 ' + current.remaining + ' 點，' : '今日鑑定點數已達上限，仍可遊玩並取得鑰匙進度，' }}單人與多人共用，台灣時間 00:00 重置。</p>
            @if (current.breakthroughUnlocked) {
              <p class="rd-done">今日已突破，上限增加 {{ current.bonusLimit }} 點。</p>
            } @else {
              <ul class="rd-goals" [attr.aria-label]="'突破上限條件，完成其中一項，今日上限提高 ' + current.bonusLimit + ' 點'">
                <li [class.is-done]="current.hasCompletedMultiplayer"><span>完成多人遊戲</span><b>{{ current.hasCompletedMultiplayer ? 1 : 0 }}／1 場</b></li>
                <li [class.is-done]="current.completedModes >= 3"><span>單人玩法達 B 級以上</span><b>{{ Math.min(3, current.completedModes) }}／3 種</b></li>
              </ul>
              <p class="rd-note">完成任一項，今日上限提高 {{ current.bonusLimit }} 點。</p>
              <button type="button" class="rd-action" data-button-tone="start" (click)="unlock()" [disabled]="busy() || !current.canBreakthrough">{{ busy() ? '解鎖中…' : '突破上限 +' + current.bonusLimit + ' 點' }}</button>
            }
          </section>
          <section class="rd-section">
            @if (keys(); as k) { <app-game-meter-row [row]="keysRow(k)" /> }
            <p>鑰匙進度滿 {{ keys()?.threshold ?? 100 }}，自動換成 1 把普通探索鑰匙，不受每日點數上限影響。</p>
            <details>
              <summary>圖鑑完成度如何影響鑰匙</summary>
              <p>圖鑑已收集 {{ current.collectedArtifacts }}／{{ current.totalArtifacts }} 件。{{ current.keyRewardDivisor === 4 ? '已收齊，鑰匙進度以原本的四分之一累積。' : current.keyRewardDivisor === 2 ? '已達 80%，鑰匙進度以原本的一半累積。' : '收集達 80% 後鑰匙進度減半，全部收齊後為四分之一。' }}</p>
              <p>不足一把的進度會保留，新增可收集文物後會重新計算。</p>
            </details>
          </section>
          @if (error()) { <p role="alert">{{ error() }}</p> }
        </div>
      </section>
    } @else if (error()) { <p role="status">今日鑑定點數進度暫時無法讀取。<button type="button" (click)="load()">重新讀取</button></p> }
  `
})
export class GameRewardMeterComponent {
  readonly detailsId = `game-reward-details-${++rewardMeterSequence}`;
  readonly detailsOpen = signal(false);
  readonly refreshToken = input<unknown>(null);
  /** compact：只留一顆收起來的小鈕，點開才看詳情；full：直接顯示雙槽（結算頁用）。 */
  readonly variant = input<'compact' | 'full'>('compact');
  /** 本局新增的鑑定點數與鑰匙進度，用來在進度條上標出增加的那一段。 */
  readonly gain = input(0);
  /** 測試模式：進度條凍結，不會增減點數與鑰匙。 */
  readonly frozen = input(false);
  readonly keyGain = input(0);
  readonly keys = signal<{ balance: number; threshold: number } | null>(null);
  private readonly keyService = inject(KeyService);
  readonly Math = Math;
  readonly status = signal<GameDailyRewardStatus | null>(null);
  readonly error = signal('');
  readonly busy = signal(false);
  private readonly game = inject(GameService);
  private readonly destroyRef = inject(DestroyRef);
  constructor() { effect(() => { this.refreshToken(); this.load(); }); }
  onDetailsToggle(event: Event): void {
    this.detailsOpen.set((event as ToggleEvent).newState === 'open');
  }
  pointsRow(current: GameDailyRewardStatus, label: string): MeterRow {
    return { label, text: `${current.earned}／${current.dailyLimit} 點`, base: this.basePercent(current), gain: this.progressPercent(current) - this.basePercent(current), tag: this.gain(), tone: 'points', now: Math.min(current.dailyLimit, current.earned), max: current.dailyLimit };
  }
  keysRow(k: { balance: number; threshold: number }): MeterRow {
    return { label: '鑰匙進度', text: `${k.balance}／${k.threshold} 片`, base: this.keyBase(k), gain: this.keyTotal(k) - this.keyBase(k), tag: this.keyGain(), tone: 'keys', now: k.balance, max: k.threshold };
  }
  basePercent(current: GameDailyRewardStatus): number {
    return current.dailyLimit > 0 ? Math.max(0, Math.min(100, (current.earned - this.gain()) / current.dailyLimit * 100)) : 0;
  }
  keyTotal(k: { balance: number; threshold: number }): number { return Math.max(0, Math.min(100, k.balance / k.threshold * 100)); }
  keyBase(k: { balance: number; threshold: number }): number { return Math.max(0, Math.min(100, (k.balance - this.keyGain()) / k.threshold * 100)); }
  progressPercent(current: GameDailyRewardStatus): number {
    return current.dailyLimit > 0 ? Math.max(0, Math.min(100, current.earned / current.dailyLimit * 100)) : 0;
  }
  load(): void {
    this.game.getMiniGameRewardStatus().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: status => { this.status.set(status); this.error.set(''); },
      error: () => this.error.set('請稍後重新讀取。')
    });
    this.keyService.getEconomy().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: economy => this.keys.set({ balance: Math.round(economy.keyProgressBalance * 10) / 10, threshold: economy.keyProgressToNormalKey || 100 }),
      error: () => this.keys.set(null)
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
