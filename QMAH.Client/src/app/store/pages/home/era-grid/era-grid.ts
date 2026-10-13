import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { EntryGrid, EntryGridItem, EntryTone } from '../../../component';
import { CatalogApi } from '../../../api';
import { eraPath } from '../../../shared/paths';
import { eraTone } from '../../../shared/category-tone';

/** 各年代的代表紋樣（見 entry-grid.scss 的 era-* 圖案）：商雷紋、周重環紋、春秋蟠螭紋、戰國雲紋、秦菱格紋、漢雲氣紋、隋聯珠紋、唐寶相花、遼金卷草紋、宋冰裂紋、元蓮瓣紋、明回紋、清如意雲頭、日本江戶青海波／明治七寶／大正市松。
 * 西夏與金沒有同樣公認的單一紋樣，這裡取常見的卷草與蓮瓣。 */
const ERA_GLYPH: Record<string, string> = {
  商: 'era-leiwen', 周: 'era-ring', 春秋: 'era-coil', 戰國: 'era-cloud', 秦: 'era-lattice', 漢: 'era-swirl',
  隋: 'era-pearl', 唐: 'era-flower', 遼: 'era-mirror', 宋: 'era-crackle', 西夏: 'era-lotus', 金: 'era-fish',
  元: 'era-banana', 明: 'era-hex', 清: 'era-ruyi',
  日本江戶時代: 'era-seigaiha', 日本明治時代: 'era-shippo', 日本大正時代: 'era-ichimatsu',
};

/** 首頁「年代選藏」區塊：與分類入口相同的色塊卡片，連往依年代篩選的商品列表 */
@Component({
  selector: 'app-era-grid',
  imports: [EntryGrid],
  templateUrl: './era-grid.html',
})
export class EraGrid {
  protected readonly eras = toSignal(
    inject(CatalogApi)
      .getEras()
      .pipe(
        map((eras) =>
          eras.map((era): EntryGridItem => ({
            name: era.name,
            count: era.productCount,
            link: eraPath(era.code),
            glyph: ERA_GLYPH[era.name] ?? 'era',
            tone: eraTone(era.name) as EntryTone,
          })),
        ),
      ),
    { initialValue: [] },
  );
}
