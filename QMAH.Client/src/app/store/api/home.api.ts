import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { CatalogApi } from './catalog.api';
import { Product, RankingQuery, RecommendedProduct } from './api.models';

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

  /**
   * 為你推薦：後端依會員買過的器類比例隨機挑選商品（沒有購買紀錄時為隨機商品），
   * 角標顯示商品的器類；失敗時視為沒有推薦。
   */
  getRecommendations(limit: number): Observable<RecommendedProduct[]> {
    return this.catalogApi.getRecommended(limit).pipe(
      map((items) => items.map((product) => ({ ...product, reason: product.category }))),
      catchError(() => of<RecommendedProduct[]>([])),
    );
  }
}
