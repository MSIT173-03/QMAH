import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { SectionHead } from '../../../component/section-head/section-head';
import { CatalogApi } from '../../../api/catalog.api';
import { PRODUCT_LIST_PATH } from '../../../shared/paths';

/** 首頁「分類入口」區塊：各分類的圖示卡片與商品件數 */
@Component({
  selector: 'app-category-grid',
  imports: [SectionHead, RouterLink],
  templateUrl: './category-grid.html',
  styleUrls: [
    './category-grid.scss',
  ],
})
export class CategoryGrid {
  /** 商品列表頁路徑，各分類卡片點擊後導向此路徑並帶上對應的 cat 查詢字串 */
  protected readonly productsPath = PRODUCT_LIST_PATH;

  /** 分類顯示資料：分類名稱與商品件數 */
  protected readonly categories = toSignal(
    inject(CatalogApi)
      .getCategories()
      .pipe(
        map((categories) =>
          categories.map((category) => ({ name: category.name, count: category.productCount })),
        ),
      ),
    { initialValue: [] },
  );
}
