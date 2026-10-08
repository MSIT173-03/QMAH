import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { CatalogApi } from './catalog.api';
import {
  Page,
  PageQuery,
  Product,
  RankingQuery,
  RecommendedProduct,
} from './api.models';

/** 首頁與行銷內容 API */
@Injectable({ providedIn: 'root' })
export class HomeApi {
  private readonly catalogApi = inject(CatalogApi);

  /** 熱銷排行：沿用商品清單 API 依販售數量排序（後端沒有專用的排行 API）；失敗時顯示空清單。 */
  getRankings(query: RankingQuery = {}): Observable<Product[]> {
    return this.catalogApi.getProducts({ cat: query.cat, order: 1, pageSize: query.limit ?? 10 }).pipe(
      map((page) => page.items),
      catchError(() => of<Product[]>([])),
    );
  }

  /** 為你推薦：沿用商品清單 API 依最新上架排序（後端沒有專用的推薦 API）；失敗時視為沒有推薦。 */
  getRecommendations(query: PageQuery = {}): Observable<Page<RecommendedProduct>> {
    return this.catalogApi.getProducts({ order: 3, page: query.page, pageSize: query.pageSize }).pipe(
      map((page) => ({
        ...page,
        items: page.items.map((product) => ({ ...product, reason: '近期上架' })),
      })),
      catchError(() => of({ items: [], total: 0, page: query.page ?? 1, pageSize: query.pageSize ?? 20 })),
    );
  }
}
