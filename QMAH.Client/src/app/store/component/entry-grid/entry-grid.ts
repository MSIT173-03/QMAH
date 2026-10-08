import { Component, input } from '@angular/core';
import { SectionHead } from '../section-head/section-head';
import { StoreLink } from '../../shared/store-link';

/** 入口卡片的底色角色 */
export type EntryTone = 'slate' | 'bronze' | 'cinnabar' | 'ochre' | 'jade' | 'celadon' | 'indigo' | 'rouge' | 'sumi' | 'plum' | 'stone';

/** 入口卡片的單一項目 */
export interface EntryGridItem {
  name: string;
  count: number;
  link: string;
  /** 底紋圖案代碼（對應 entry-grid.scss 的 data-glyph，與圖鑑分類籤同一組圖案）。 */
  glyph: string;
  tone: EntryTone;
}

/** 首頁入口區塊（分類入口、年代選藏共用）：區塊標題與色塊入口卡片 */
@Component({
  selector: 'app-entry-grid',
  imports: [SectionHead, StoreLink],
  templateUrl: './entry-grid.html',
  styleUrl: './entry-grid.scss',
})
export class EntryGrid {
  title = input.required<string>();
  tag = input<string | null>(null);
  items = input<EntryGridItem[]>([]);
  /** 寬版面固定每列幾欄（例如年代選藏 9 欄＝18 項剛好兩列）；未設定則自動換行。 */
  columns = input<number | null>(null);
}
