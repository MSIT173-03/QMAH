import { Component, computed, input } from '@angular/core';
import { SectionHead } from '../../../component';
import { PRODUCT_LIST_PATH } from '../../../shared/paths';
import { StoreLink } from '../../../shared/store-link';

/** 首頁「分類入口」區塊：各分類的圖示卡片與商品件數 */
@Component({
  selector: 'app-category-grid',
  imports: [SectionHead, StoreLink],
  templateUrl: './category-grid.html',
  styleUrls: [
    './category-grid.scss',
  ],
})
export class CategoryGrid {
  /** 各器類的上架商品數量（key 為器類名稱，順序即顯示順序） */
  counts = input<Record<string, number>>({});
  /** 各器類的封面圖網址（key 為器類名稱），無圖片時顯示佔位文字 */
  images = input<Record<string, string | null>>({});

  /** 分類顯示資料：分類名稱、商品件數、封面圖與連結網址（商品列表頁並帶上對應的 cat 查詢字串） */
  protected readonly categories = computed(() =>
    Object.entries(this.counts()).map(([name, count]) => ({
      name,
      count,
      image: this.images()[name] ?? null,
      link: `${PRODUCT_LIST_PATH}?cat=${encodeURIComponent(name)}`,
    })),
  );

  /** 區塊標籤：商品總件數，尚無資料時只顯示 CATEGORIES */
  protected readonly tagText = computed(() => {
    const total = Object.values(this.counts()).reduce((sum, n) => sum + n, 0);
    return total > 0 ? `CATEGORIES · ${total} 件` : 'CATEGORIES';
  });
}
