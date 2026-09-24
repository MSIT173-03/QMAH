import { Component, input } from '@angular/core';
import { SectionHead } from '../section-head/section-head';
import { StoreLink } from '../../shared/store-link';
import { QmahIconComponent } from '../../../shared/components/qmah-icon/qmah-icon';
import type { QmahIconName } from '../../../shared/components/qmah-icon/qmah-icon';

/** 入口卡片的底色角色 */
export type EntryTone = 'jade' | 'gold' | 'azurite' | 'cinnabar';

/** 入口卡片的單一項目 */
export interface EntryGridItem {
  name: string;
  count: number;
  link: string;
  icon: QmahIconName;
  tone: EntryTone;
}

/** 首頁入口區塊（分類入口、年代選藏共用）：區塊標題與色塊入口卡片 */
@Component({
  selector: 'app-entry-grid',
  imports: [SectionHead, StoreLink, QmahIconComponent],
  templateUrl: './entry-grid.html',
  styleUrl: './entry-grid.scss',
})
export class EntryGrid {
  title = input.required<string>();
  tag = input<string | null>(null);
  items = input<EntryGridItem[]>([]);
}
