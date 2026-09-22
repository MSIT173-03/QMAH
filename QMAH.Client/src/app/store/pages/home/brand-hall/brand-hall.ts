import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { EntryGrid, EntryGridItem, EntryTone } from '../../../component';
import { CatalogApi } from '../../../api';
import { PRODUCT_LIST_PATH } from '../../../shared/paths';

/** 年代卡片依時間順序輪替底色，讓相鄰年代在視覺上可區分 */
const ERA_TONES: EntryTone[] = ['gold', 'azurite', 'cinnabar', 'jade'];

/** 首頁「年代選藏」區塊：與分類入口相同的色塊卡片，連往依年代篩選的商品列表 */
@Component({
  selector: 'app-brand-hall',
  imports: [EntryGrid],
  templateUrl: './brand-hall.html',
})
export class BrandHall {
  protected readonly eras = toSignal(
    inject(CatalogApi)
      .getEras()
      .pipe(
        map((eras) =>
          eras.map((era, index): EntryGridItem => ({
            name: era.name,
            count: era.productCount,
            link: `${PRODUCT_LIST_PATH}?era=${encodeURIComponent(era.code)}`,
            icon: 'calendar-clock',
            tone: ERA_TONES[index % ERA_TONES.length],
          })),
        ),
      ),
    { initialValue: [] },
  );
}
