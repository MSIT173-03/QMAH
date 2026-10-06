import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { QmahIconComponent } from '../shared/components/qmah-icon/qmah-icon';
import { MiniGameComplete } from './game.models';

/** 結算的「本局獎勵入帳」：點數與鑰匙數字往上跳，鑰匙進度條同步填滿。 */
@Component({
  selector: 'app-game-result-tally',
  imports: [QmahIconComponent, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './game-result-tally.component.scss',
  template: `
    <section class="reward-tally" aria-labelledby="tally-title">
      <header class="tally-head">
        <h3 id="tally-title">本局獎勵入帳</h3>
        @if (!complete().alreadyCompleted && !complete().economicRewardGranted) {
          <span class="tally-warn">操作太少，本局不計獎勵（至少操作 3 次，或實際遊玩 20 秒以上）</span>
        } @else if (!complete().alreadyCompleted) {
          @if (complete().pointReward === 0) { <span class="tally-warn">今日鑑定點數已達上限</span> }
          @if (complete().keyProgressReward === 0) { <span class="tally-warn">今日鑰匙進度已達上限</span> }
        }
      </header>
      <div class="tally-grid">
        <div class="tally-card" data-tone="points" [class.is-zero]="complete().pointReward === 0">
          <app-qmah-icon class="tile-icon" name="coins" aria-hidden="true" />
          <span class="tally-label">鑑定點數</span>
          <b class="tally-num" [style.--to]="complete().pointReward" [attr.aria-label]="'獲得 ' + complete().pointReward + ' 點'"></b>
        </div>
        <div class="tally-card" data-tone="keys" [class.is-zero]="complete().keyProgressReward === 0">
          <app-qmah-icon class="tile-icon" name="key-round" aria-hidden="true" />
          <span class="tally-label">鑰匙進度</span>
          <small class="tally-key-meta">
            <span>{{ complete().remainingKeyProgress | number:'1.0-6' }}／100 · 滿 100 換 1 把</span>
            @if (complete().keyRewardDivisor > 1) {
              <span title="依圖鑑完成度調整本局鑰匙獎勵">本局獎勵 × 1/{{ complete().keyRewardDivisor }}</span>
            }
          </small>
          <b class="tally-num is-decimal" [attr.aria-label]="'獲得 ' + complete().keyProgressReward + ' 鑰匙進度'">+{{ complete().keyProgressReward | number:'1.0-6' }}</b>
          <span class="tally-bar" aria-hidden="true"><i [style.--w]="complete().remainingKeyProgress"></i></span>
          @if (showKeyNotice()) {
            <div class="key-conversion-notice" role="status" aria-live="polite">
              <app-qmah-icon name="key-round" aria-hidden="true" />
              <span>本局換得普通鑰匙 <strong>＋{{ complete().convertedNormalKeys }} 把</strong></span>
            </div>
          }
        </div>
      </div>
      @if (complete().alreadyCompleted) { <p class="tally-note">這是已結算的結果，不會重複發放獎勵。</p> }
    </section>
  `
})
export class GameResultTallyComponent {
  readonly complete = input.required<MiniGameComplete>();
  readonly showKeyNotice = computed(() => this.complete().convertedNormalKeys > 0);
}
