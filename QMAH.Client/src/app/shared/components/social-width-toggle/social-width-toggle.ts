import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LucideFoldHorizontal, LucideUnfoldHorizontal } from '@lucide/angular';
import { SocialViewPreferences } from '../../../core/services/social-view-preferences';

/** 社群子頁面的寬版／標準切換鈕，和貼文牆工具列共用同一個偏好設定。 */
@Component({
  selector: 'app-social-width-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideFoldHorizontal, LucideUnfoldHorizontal],
  styles: [`
    :host { float: right; }
    button { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 12px; border: 1px solid var(--qmah-border); border-radius: 999px; background: var(--qmah-surface-elevated, var(--qmah-surface)); color: var(--qmah-ink); font: inherit; font-size: 0.875rem; font-weight: 700; cursor: pointer; }
    button:hover { border-color: var(--qmah-social-action); }
    button:focus-visible { outline: 2px solid var(--qmah-social-action); outline-offset: 2px; }
    svg { width: 16px; height: 16px; }
    @media (max-width: 900px) { :host { display: none; } }
  `],
  template: `
    <button type="button" [attr.aria-pressed]="view.wide()" (click)="view.toggle()">
      @if (view.wide()) { <svg lucideFoldHorizontal aria-hidden="true" focusable="false"></svg> } @else { <svg lucideUnfoldHorizontal aria-hidden="true" focusable="false"></svg> }
      {{ view.wide() ? '切換標準版面' : '切換寬版' }}
    </button>
  `,
})
export class SocialWidthToggleComponent {
  protected readonly view = inject(SocialViewPreferences);
}
