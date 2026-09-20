import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { SectionHead } from '../../../component';
import { CatalogApi } from '../../../api';
import { PRODUCT_LIST_PATH } from '../../../shared/paths';
import { StoreLink } from '../../../shared/store-link';
import { QmahIconComponent } from '../../../../shared/components/qmah-icon/qmah-icon';
import type { QmahIconName } from '../../../../shared/components/qmah-icon/qmah-icon';

/** 首頁「分類入口」區塊：各分類的圖示卡片與商品件數 */
@Component({
  selector: 'app-category-grid',
  imports: [SectionHead, StoreLink, QmahIconComponent],
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

  /**
   * ui-integration: 分類仍維持原本的入口卡片配置，只替換重複 Shapes 圖示，讓圖示
   * 對應分類語意；未知分類回到既有的通用圖示，避免資料新增時破版。
   */
  protected categoryIcon(name: string): QmahIconName {
    const normalizedName = name.toLowerCase();

    if (normalizedName.includes('陶') || normalizedName.includes('瓷')) return 'shapes';
    if (normalizedName.includes('玉')) return 'gem';
    if (normalizedName.includes('青銅') || normalizedName.includes('金屬')) return 'shield-check';
    if (normalizedName.includes('畫') || normalizedName.includes('書') || normalizedName.includes('文獻')) return 'image';
    if (normalizedName.includes('錢') || normalizedName.includes('幣')) return 'badge';
    if (normalizedName.includes('飾') || normalizedName.includes('器')) return 'library';

    return 'shapes';
  }
}
