import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MiniGameMode } from './game.models';

interface ScoreRule { name: string; base: string; deductions: string[]; }

// 與伺服端 MiniGamePlacementScoring、MiniGameDetailLocatorScoring、MiniGameService 的算法一致；改算法時一併更新這裡。
const RULES: Record<string, ScoreRule> = {
  DETAIL_LOCATOR: {
    name: '細節追跡',
    base: '四件文物各定位一次，每件點中得 25 分，滿分 100。點的位置落在正確處附近（約原圖短邊的五分之一見方）就算點中。',
    deductions: ['區域提示：每次 −10 分', '系統代答：該題照給 25 分，但另扣 15 分']
  },
  MEMORY_MATCH: {
    name: '館藏翻牌',
    base: '八對圖樣，開局先全部翻開 5 秒讓你記，每配對成功一對得 12.5 分，滿分 100。',
    deductions: ['提示：每次 −3 分', '系統代配：每對約 −7.5 分']
  },
  ARTIFACT_PUZZLE: {
    name: '館藏拼圖',
    base: '放在正確位置的碎片比例就是完成度，25 塊全對為 100 分。困難（先看 10 秒原圖）滿分 100 分。簡單（空格上直接對照原圖）最高 80 分。',
    deductions: ['用時：前 5 分鐘不扣，之後每 30 秒 −1 分，最多 −10', '放置次數：超過 25 次後每多一次約 −0.6 分，最多 −25', '提示：每次 −3 分', '系統代放：每片 −2.4 分']
  },
  STRIP_RESTORE: {
    name: '書畫拼貼',
    base: '15 片碎片放回正確格子，比例就是完成度，全部拼回為 100 分。簡單點兩片相鄰碎片交換。困難少一格，把碎片滑進空格。',
    deductions: ['用時：簡單前 10 分鐘、困難前 7 分鐘不扣，之後每經過同樣長度的 1/10 扣 1 分，最多 −10', '移動次數：簡單超過 100 次、困難超過 60 次後，每多一次 −1 分，最多 −25', '提示：每次 −3 分', '系統代放：每片 −4 分']
  }
};

let guideSequence = 0;

/** 每種單人玩法的評分標準：怎麼得分、怎麼扣分、各評級的分數門檻。 */
@Component({
  selector: 'app-game-scoring-guide',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './game-scoring-guide.component.scss',
  template: `
    @if (rule(); as r) {
      @if (!inline()) { <button type="button" class="scoring-trigger" [attr.popovertarget]="id" aria-label="評分標準" title="評分標準">i</button> }
      <div class="scoring" [id]="id" [attr.popover]="inline() ? null : 'auto'" [class.is-inline]="inline()" [attr.aria-label]="r.name + '評分標準'">
        <h3>{{ r.name }}怎麼計分</h3>
        <p class="scoring-base">{{ r.base }}</p>
        @if (mode(); as m) {
          <ol class="grade-ladder" aria-label="評級門檻">
            <li data-grade="B"><b>B</b><span>{{ m.gradeBThreshold }} 分以上</span></li>
            <li data-grade="A"><b>A</b><span>{{ m.gradeAThreshold }} 分以上</span></li>
            <li data-grade="S"><b>S</b><span>{{ m.gradeSThreshold }} 分以上</span></li>
          </ol>
        }
        <h4>會扣分的地方</h4>
        <ul class="scoring-deductions">@for (line of r.deductions; track line) { <li>{{ line }}</li> }</ul>
        <p class="scoring-note">簡單最高 80 分，困難最高 100 分。使用系統代答，最高 A 級。正式遊戲完成並送出後，即使未達 B 級也有基本獎勵：未得分至少 2 點／10 鑰匙進度，C 級至少 4 點／15 進度；B、A、S 級分別至少 6、8、10 點與 20、30、40 進度。點數每天最多 100，鑰匙進度每天最多 1000，約 10 把鑰匙，也會依收藏比例調整。試玩與放棄不發獎勵。</p>
        @if (!inline()) { <button type="button" class="scoring-close" [attr.popovertarget]="id" popovertargetaction="hide">知道了</button> }
      </div>
    }
  `
})
export class GameScoringGuideComponent {
  readonly code = input.required<string>();
  readonly mode = input<MiniGameMode | null>(null);
  readonly inline = input(false);
  readonly id = `game-scoring-${++guideSequence}`;
  protected readonly rule = computed(() => RULES[this.code()] ?? null);
}
