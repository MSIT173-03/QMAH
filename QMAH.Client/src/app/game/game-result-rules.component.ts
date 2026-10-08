import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { GameScoringGuideComponent } from './game-scoring-guide.component';
import { MiniGameMode, MiniGameStart } from './game.models';

/** 結算頁的「評分標準」浮層：計分規則加上本局的提示與協助次數。 */
@Component({
  selector: 'app-game-result-rules',
  imports: [GameScoringGuideComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './game-result-rules.component.scss',
  template: `
  <aside class="result-rules" [id]="'result-rules-' + attempt().attemptId" popover="auto" aria-label="計分與輔助說明">
    <app-game-scoring-guide [code]="attempt().modeCode" [mode]="mode()" [inline]="true" />
    <p class="result-own">本局提示 {{ hintsUsed() }} 次，系統協助 {{ autoPlaced() }} {{ attempt().modeCode === 'MEMORY_MATCH' ? '組' : attempt().modeCode === 'DETAIL_LOCATOR' ? '題' : '片' }}。</p>
    <button type="button" [attr.popovertarget]="'result-rules-' + attempt().attemptId" popovertargetaction="hide">返回成績卡片</button>
  </aside>
  `
})
export class GameResultRulesComponent {
  readonly attempt = input.required<MiniGameStart>();
  readonly mode = input<MiniGameMode | null>(null);
  readonly hintsUsed = input(0);
  readonly autoPlaced = input(0);
}
