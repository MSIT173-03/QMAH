import { Component, input } from '@angular/core';
import { SiteLink } from '../../api/api.models';
import { StoreLink } from '../../shared/store-link';

/**
 * 頁面標題列：顯示頁面標題，並可選擇性搭配標籤、統計數字或附加連結，用於各頁面頂部。
 */
@Component({
  selector: 'app-page-title-row',
  imports: [StoreLink],
  templateUrl: './page-title-row.html',
  styleUrl: './page-title-row.scss',
})
export class PageTitleRow {
  /** 頁面標題文字 */
  title = input('');
  /** 例如「CART」「CHECKOUT」 */
  tag = input<string | null>(null);
  /** 例如商品列表頁的「128 件商品」 */
  count = input<string | null>(null);
  /** 例如「繼續選購 →」「管理個人資料 →」 */
  link = input<SiteLink | null>(null);
}
