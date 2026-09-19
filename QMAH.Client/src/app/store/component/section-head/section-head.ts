import { Component, input } from '@angular/core';

/**
 * 區塊標題：顯示標題文字並可選擇性搭配標籤，依 variant 套用頁面區塊標題或面板內標題兩種樣式。
 */
@Component({
  selector: 'app-section-head',
  imports: [],
  templateUrl: './section-head.html',
  styleUrls: [
    './section-head.scss',
  ],
})
export class SectionHead {
  /** 標題文字 */
  title = input('');
  /** 標題旁的標籤文字，為 null 時不顯示 */
  tag = input<string | null>(null);
  /** 標題使用的 heading 標籤層級 */
  headingLevel = input<'h2' | 'h3'>('h3');

  /** section：頁面區塊標題（含底線）；panel：面板內標題（無底線），用於 .panel 內的 panel-head */
  variant = input<'section' | 'panel'>('section');
  /** 首頁熱銷排行等會換行的標題列 */
  wrap = input(false);
}
