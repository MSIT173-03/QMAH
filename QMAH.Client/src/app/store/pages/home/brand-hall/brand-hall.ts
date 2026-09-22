import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { StoreLink } from '../../../shared/store-link';
import { CatalogService } from '../../../../services/catalog-service';
import { Panel, SectionHead } from '../../../component';
import { catchError, of } from 'rxjs';

/**
 * 首頁的年代選藏面板。
 * ui-integration: 品牌 API 沒有對應的實際商城 route，改用既有圖鑑年代篩選作為可抵達的入口，
 * 避免保留「品牌館」這種沒有資料來源也沒有目的地的導覽詞，改以既有年代資料作為選藏入口。
 */
@Component({
  selector: 'app-brand-hall',
  imports: [Panel, SectionHead, StoreLink],
  templateUrl: './brand-hall.html',
  styleUrls: [
    './brand-hall.scss',
  ],
})
export class BrandHall {
  /** 使用既有 Catalog 年代對照 API，不另造一份商城專用年代資料。 */
  protected readonly eras = toSignal(
    inject(CatalogService).getEras().pipe(catchError(() => of([]))),
    { initialValue: [] },
  );

  protected eraHref(name: string): string {
    return `/artifact-list?era=${encodeURIComponent(name)}`;
  }
}
