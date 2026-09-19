import { Component, input, output } from '@angular/core';

/** 分類篩選清單的單一項目 */
export interface CategoryListItem {
  /** 分類名稱 */
  name: string;
  /** 該分類的商品件數 */
  count: number;
  /** 是否為目前選取的分類 */
  active?: boolean;
}

/**
 * 分類篩選清單：垂直排列的「分類名稱 + 件數」按鈕。
 * 元件本身不含容器樣式（:host 為 display: contents），因此各按鈕會直接成為外層面板的子項，
 * 由外層面板決定項目間距。
 */
@Component({
  selector: 'app-category-list',
  imports: [],
  templateUrl: './category-list.html',
  styleUrls: [
    './category-list.scss',
  ],
})
export class CategoryList {
  /** 分類項目清單 */
  items = input<CategoryListItem[]>([]);

  /** 點擊某個分類時觸發，帶出該分類在 items 中的索引值 */
  pick = output<number>();
}
