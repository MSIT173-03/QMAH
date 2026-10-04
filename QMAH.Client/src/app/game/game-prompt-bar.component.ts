import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { GameConsole } from './game-console.service';

export interface PromptHint {
  /** 鍵盤上的按鍵。 */
  keys: string[];
  /** 手把上的按鍵，沒有就沿用鍵盤。 */
  pad?: string[];
  label: string;
}

// 舞台底部的按鍵提示：接了手把就顯示手把按鍵，其餘顯示鍵盤；純觸控裝置不顯示。
@Component({
  selector: 'app-game-prompt-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-gamepad]': 'pad()', role: 'note', 'aria-label': '操作提示' },
  template: `
    @for (hint of shown(); track hint.label) {
      <span class="hint">
        @for (key of hint.keys; track key) { <kbd>{{ key }}</kbd> }
        <span>{{ hint.label }}</span>
      </span>
    }
  `,
  styles: `
    :host { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px 22px; padding-top: 12px; border-top: 2px dashed #ffffff33; color: var(--game-table-muted, #f3f0db); font-size: 14px; }
    .hint { display: inline-flex; align-items: center; gap: 6px; }
    kbd { display: inline-grid; place-items: center; min-width: 28px; height: 28px; padding: 0 8px; border: 2px solid #6d5841; border-radius: 7px; color: #334737; background: #fff2d9; box-shadow: 0 2px 5px #33251433; font: 800 13px/1 var(--qmah-font-sans, sans-serif); }
    :host(.is-gamepad) kbd { border-radius: 50%; min-width: 30px; }
    @media (hover: none) and (pointer: coarse) { :host(:not(.is-gamepad)) { display: none; } }
  `
})
export class GamePromptBarComponent {
  private readonly console = inject(GameConsole);
  readonly hints = input<PromptHint[]>([]);
  protected readonly pad = computed(() => this.console.mode() === 'gamepad' || this.console.gamepad());
  protected readonly shown = computed(() => {
    const base: PromptHint[] = [
      { keys: ['↑', '↓', '←', '→'], pad: ['十字鍵'], label: '移動' },
      { keys: ['Enter'], pad: ['A'], label: '確認' },
      { keys: ['Esc'], pad: ['B'], label: '返回' }
    ];
    const all = [...base, ...this.hints()];
    return all.map(hint => ({ keys: this.pad() ? hint.pad ?? hint.keys : hint.keys, label: hint.label }));
  });
}
