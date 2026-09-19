import { Component, inject } from '@angular/core';
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
  /** 分類顯示資料：分類名稱、商品件數與連結網址 */
  protected readonly categories = toSignal(
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
}
