import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { QmahIconComponent } from '../shared/components/qmah-icon/qmah-icon';
import { MiniGameComplete } from './game.models';

/** 結算的「本局獎勵入帳」：點數與鑰匙數字往上跳，鑰匙進度條同步填滿。 */
@Component({
  selector: 'app-game-result-tally',
  imports: [QmahIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './game-result-tally.component.scss',
  template: `
    <section class="reward-tally" aria-labelledby="tally-title">
      <header class="tally-head">
        <h3 id="tally-title">本局獎勵入帳</h3>
        @if (!complete().alreadyCompleted) {
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
          <b class="tally-num" [style.--to]="complete().keyProgressReward" [attr.aria-label]="'獲得 ' + complete().keyProgressReward + ' 片'"></b>
          <span class="tally-bar" aria-hidden="true"><i [style.--w]="complete().remainingKeyProgress"></i></span>
        </div>
        @if (complete().convertedNormalKeys > 0) {
          <div class="tally-card is-wide" data-tone="keys">
            <app-qmah-icon class="tile-icon" name="key-round" aria-hidden="true" />
            <span class="tally-label">換得普通鑰匙</span>
            <b class="tally-num is-plain" [style.--to]="complete().convertedNormalKeys"></b>
          </div>
        }
      </div>
      <p class="tally-note">鑰匙進度每滿 100 換 1 把，目前 {{ complete().remainingKeyProgress }}／100。</p>
      @if (complete().keyRewardDivisor > 1) { <p class="tally-note">依圖鑑完成度，本局鑰匙獎勵以原本的{{ complete().keyRewardDivisor === 2 ? '一半' : '四分之一' }}累積。</p> }
      @if (complete().alreadyCompleted) { <p class="tally-note">這是已結算的結果，不會重複發放獎勵。</p> }
    </section>
  `
})
export class GameResultTallyComponent {
  readonly complete = input.required<MiniGameComplete>();
}
