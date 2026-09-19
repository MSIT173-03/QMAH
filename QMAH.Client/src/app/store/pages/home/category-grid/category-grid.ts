import { Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { SectionHead } from '../../../component';
import { CatalogApi } from '../../../api';
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
  /** 各器類的上架商品數量（key 為器類名稱）；有值時優先於分類清單自帶的件數 */
  counts = input<Record<string, number>>({});

  /** 分類顯示資料：分類名稱、商品件數與連結網址 */
  private readonly baseCategories = toSignal(
    inject(CatalogApi)
      .getCategories()
      .pipe(
        map((categories) =>
          categories.map((category) => ({
            name: category.name,
            count: category.productCount,
            /** 商品列表頁並帶上對應的 cat 查詢字串 */
            link: `${PRODUCT_LIST_PATH}?cat=${encodeURIComponent(category.name)}`,
          })),
        ),
      ),
    { initialValue: [] },
  );

  protected readonly categories = computed(() =>
    this.baseCategories().map((category) => ({
      ...category,
      count: this.counts()[category.name] ?? category.count,
    })),
  );

  /** 區塊標籤：商品總件數，尚無資料時只顯示 CATEGORIES */
  protected readonly tagText = computed(() => {
    const total = Object.values(this.counts()).reduce((sum, n) => sum + n, 0);
    return total > 0 ? `CATEGORIES · ${total} 件` : 'CATEGORIES';
  });
}
