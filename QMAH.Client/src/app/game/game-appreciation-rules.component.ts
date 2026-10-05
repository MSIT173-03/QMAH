import { ChangeDetectionStrategy, Component } from '@angular/core';

/** 入選與投票規則：按鈕加上說明浮層，內容固定，不需要任何狀態。 */
@Component({
  selector: 'app-game-appreciation-rules',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './game-appreciation-rules.component.scss',
  template: `
    <button type="button" class="rules" popovertarget="appreciation-rules"><span class="rules-i" aria-hidden="true">i</span>入選規則</button>
    <div id="appreciation-rules" class="rules-content" popover="auto" aria-labelledby="appreciation-rules-title">
      <header class="rules-heading">
        <h3 id="appreciation-rules-title">入選與投票規則</h3>
        <button type="button" class="rules-close" popovertarget="appreciation-rules" popovertargetaction="hide" aria-label="關閉規則"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
      </header>
      <ol class="rules-list">
        <li>
          <b class="rules-no" aria-hidden="true">1</b>
          <div><h4>怎樣入選</h4><p>每局多人遊戲結束後，三種類型各取遊戲得票最高的一則回答。沒有回答的類型不會入選。</p><small>同票時先送出者優先，再依回答識別碼決定。</small></div>
        </li>
        <li>
          <b class="rules-no" aria-hidden="true">2</b>
          <div><h4>鑑賞票</h4><p>每則回答可以投一票，也能收回。不能投自己的回答。</p><small>鑑賞票另外計算，不影響遊戲勝負與獎勵。</small></div>
        </li>
        <li>
          <b class="rules-no" aria-hidden="true">3</b>
          <div>
            <h4>三種回答</h4>
            <dl class="rules-types">
              <div data-type="FACTUAL_REASONING"><dt>史實推理</dt><dd>推測文物真正的名稱、用途、年代或背景，仍需與文物資料核對。</dd></div>
              <div data-type="PLAUSIBLE_FICTION"><dt>擬真異說</dt><dd>看似合理的虛構說明。</dd></div>
              <div data-type="CREATIVE_TALE"><dt>妙想奇談</dt><dd>幽默、誇張或帶有故事性的創意回答。</dd></div>
            </dl>
          </div>
        </li>
      </ol>
    </div>
  `
})
export class GameAppreciationRulesComponent {}
