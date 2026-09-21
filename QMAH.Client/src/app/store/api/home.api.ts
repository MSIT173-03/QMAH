import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { CatalogApi } from './catalog.api';
import {
  Brand,
  Coupon,
  FlashSale,
  HeroSlide,
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

  /** 主視覺由 HeroCarousel 維持本地 editorial fallback，後端尚無版位契約。 */
  getHeroSlides(): Observable<HeroSlide[]> {
    return of<HeroSlide[]>([]);
  }

  /** 後端尚無限時特賣契約，維持空狀態，不發出不存在的請求。 */
  getFlashSale(): Observable<FlashSale> {
    return of({ endsAt: '', items: [] });
  }

  /** 舊版品牌資料介面，前台目前改用年代選藏；後端沒有此 Store route。 */
  getBrands(): Observable<Brand[]> {
    return of<Brand[]>([]);
  }

  /** 以現有商品型錄的販售數量排序代替尚未存在的 rankings route。 */
  getRankings(query: RankingQuery = {}): Observable<Product[]> {
    return this.catalogApi.getProducts({ cat: query.cat, order: 1, pageSize: query.limit ?? 10 }).pipe(map((page) => page.items));
  }

  /** 以現有商品型錄的最新上架排序代替尚未存在的 recommendations route。 */
  getRecommendations(query: PageQuery = {}): Observable<Page<RecommendedProduct>> {
    return this.catalogApi.getProducts({ order: 3, page: query.page, pageSize: query.pageSize }).pipe(
      map((page) => ({
        ...page,
        items: page.items.map((product) => ({ ...product, reason: '近期上架' })),
      })),
    );
  }

  /** 可領取折價券尚無前台 API，避免把持有券誤當成可領取券。 */
  getClaimableCoupons(): Observable<Coupon[]> {
    return of<Coupon[]>([]);
  }
}
