import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { EntryGrid, EntryGridItem, EntryTone } from '../../../component';
import { CatalogApi } from '../../../api';
import { eraPath } from '../../../shared/paths';
import { ERA_FALLBACK } from '../../../../artifact-list/artifact-list';

/** 年代色與圖鑑相同：依年代起始年分成九個顏料色，日本各時代用藤紫。 */
function eraTone(name: string): EntryTone {
  if (name.startsWith('日本')) return 'plum';
  const start = ERA_FALLBACK.find((era) => era.name === name)?.start;
  if (start == null) return 'stone';
  if (start < -2000) return 'slate';
  if (start < -475) return 'bronze';
  if (start < 220) return 'cinnabar';
  if (start < 618) return 'ochre';
  if (start < 907) return 'jade';
  if (start < 1271) return 'celadon';
  if (start < 1644) return 'indigo';
  if (start < 1868) return 'rouge';
  return 'sumi';
}

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
            glyph: 'era',
            tone: eraTone(era.name),
          })),
        ),
      ),
    { initialValue: [] },
  );
}
