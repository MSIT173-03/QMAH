import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { EntryGrid, EntryGridItem, EntryTone } from '../../../component';
import { CatalogApi } from '../../../api';
import { categoryPath } from '../../../shared/paths';
import type { QmahIconName } from '../../../../shared/components/qmah-icon/qmah-icon';

/** 首頁「分類入口」區塊：各分類的色塊卡片與商品件數 */
@Component({
  selector: 'app-category-grid',
  imports: [EntryGrid],
  templateUrl: './category-grid.html',
})
export class CategoryGrid {
  protected readonly categories = toSignal(
    inject(CatalogApi)
      .getCategories()
      .pipe(
        map((categories) =>
          categories.map((category): EntryGridItem => ({
            name: category.name,
            count: category.productCount,
            link: categoryPath(category.name),
            icon: this.categoryIcon(category.name),
            tone: this.categoryTone(category.name),
          })),
        ),
      ),
    { initialValue: [] },
  );

  /** 依分類語意選擇圖示；未知分類回到通用圖示，避免資料新增時破版。 */
  private categoryIcon(name: string): QmahIconName {
    if (name.includes('陶') || name.includes('瓷')) return 'shapes';
    if (name.includes('玉')) return 'gem';
    if (name.includes('青銅') || name.includes('金屬')) return 'shield-check';
    if (name.includes('畫') || name.includes('書') || name.includes('文獻')) return 'image';
    if (name.includes('錢') || name.includes('幣')) return 'badge';
    if (name.includes('飾') || name.includes('器')) return 'library';
    return 'shapes';
  }

  private categoryTone(name: string): EntryTone {
    if (name.includes('青銅') || name.includes('錢') || name.includes('幣')) return 'gold';
    if (name.includes('繪') || name.includes('陶') || name.includes('瓷') || name.includes('琺瑯')) return 'azurite';
    if (name.includes('雕')) return 'cinnabar';
    return 'jade';
  }
}
