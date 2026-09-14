import { Component, computed, input, output } from '@angular/core';
import { Panel } from '../panel/panel';
import { CategoryList, CategoryListItem } from '../category-list/category-list';
import { PillGroup, PillOption } from '../pill-group/pill-group';

/**
 * 商品列表頁篩選側欄：分類、價格區間與折扣篩選三個面板。
 * 面板標題與按鈕文案屬於固定版面文字，直接寫在元件內；
 * 各篩選項目與目前選取狀態則由外部傳入，選取結果以事件回報。
 */
@Component({
  selector: 'app-filter-sidebar',
  imports: [Panel, CategoryList, PillGroup],
  templateUrl: './filter-sidebar.html',
  styleUrls: [
    './filter-sidebar.scss',
  ],
})
export class FilterSidebar {
  /** 分類篩選項目（含件數與是否選取） */
  categories = input<CategoryListItem[]>([]);
  /** 價格區間篩選項目文字，順序即顯示順序 */
  bands = input<string[]>([]);
  /** 目前選取的價格區間索引 */
  activeBand = input(0);
  /** 是否只顯示折扣商品 */
  dealOnly = input(false);

  /** 面板標題文字（固定版面文字） */
  protected readonly categoryLabel = 'CATEGORY';
  protected readonly priceLabel = 'PRICE';
  protected readonly filterLabel = 'FILTER';
  /** 折扣篩選按鈕文字 */
  protected readonly dealLabel = '只看折扣商品';
  /** 清除篩選按鈕文字 */
  protected readonly resetLabel = '清除所有篩選';

  /** 價格區間選項，選取狀態由 activeBand 於元件內推導 */
  protected bandOptions = computed<PillOption[]>(() =>
    this.bands().map((label, i) => ({ label, active: i === this.activeBand() })),
  );
  /** 折扣篩選選項，僅一項；選取狀態由 dealOnly 於元件內推導 */
  protected dealOptions = computed<PillOption[]>(() => [{ label: this.dealLabel, active: this.dealOnly() }]);

  /** 點擊某個分類時觸發，帶出該分類在 categories 中的索引值 */
  categoryPick = output<number>();
  /** 點擊某個價格區間時觸發，帶出該區間在 bands 中的索引值 */
  bandPick = output<number>();
  /** 點擊折扣篩選按鈕時觸發（切換開關） */
  dealToggle = output<void>();
  /** 點擊「清除所有篩選」時觸發 */
  reset = output<void>();
}
