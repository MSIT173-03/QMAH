import { Component, input } from '@angular/core';

/**
 * 會員子頁共用的標題列（與商城各頁標題列同一個樣子）：標題＋同一行的英文標籤（主色），下方一條細線，
 * 其後可選的說明文字；右側可以用 <ng-content> 放按鈕或狀態。所有會員子頁都用它，標題區才會一致。
 */
@Component({
  selector: 'app-member-title',
  template: `
    <header class="mt">
      <div class="mt__row">
        <h1>{{ title() }}</h1>
        <span class="mt__tag">{{ tag() }}</span>
        <span class="mt__aside"><ng-content /></span>
      </div>
      @if (desc()) { <p class="mt__desc">{{ desc() }}</p> }
    </header>
  `,
  styles: `
    :host { display: block; margin: 0 0 20px; }
    .mt__row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 14px; padding-bottom: 10px; border-bottom: 1px solid var(--qmah-ink, #333); }
    h1 { margin: 0; font-size: 34px; line-height: 1.1; }
    .mt__tag { color: var(--qmah-primary); font-size: 13px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; }
    .mt__aside { margin-left: auto; align-self: center; display: inline-flex; align-items: center; gap: 10px; }
    .mt__desc { margin: 10px 0 0; color: var(--qmah-text-muted, #666); }
    @media (max-width: 480px) { h1 { font-size: 28px; } }
  `,
})
export class MemberTitle {
  title = input.required<string>();
  tag = input.required<string>();
  desc = input('');
}
