import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { EntryGrid, EntryGridItem, EntryTone } from '../../../component';
import { CatalogApi } from '../../../api';
import { categoryPath } from '../../../shared/paths';

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
            glyph: this.categoryGlyph(category.name),
            tone: this.categoryTone(category.name),
          })),
        ),
      ),
    { initialValue: [] },
  );

  /** 與圖鑑的分類籤使用同一組圖案。 */
  private categoryGlyph(name: string): string {
    if (/琺瑯/.test(name)) return 'rouge';
    if (/銅|金|銀|錫|鐵/.test(name)) return 'bronze';
    if (/幣/.test(name)) return 'coin';
    if (/陶|瓷|磚|瓦/.test(name)) return 'clay';
    if (/漆/.test(name)) return 'lacquer';
    if (/玉/.test(name)) return 'jade';
    if (/畫|書|紙|帖|絹|織|繡/.test(name)) return 'painting';
    if (/雕|刻|佛|像/.test(name)) return 'carving';
    return 'stone';
  }

  private categoryTone(name: string): EntryTone {
    if (name.includes('青銅') || name.includes('錢') || name.includes('幣')) return 'gold';
    if (name.includes('繪') || name.includes('陶') || name.includes('瓷') || name.includes('琺瑯')) return 'azurite';
    if (name.includes('雕')) return 'cinnabar';
    return 'jade';
  }
}
