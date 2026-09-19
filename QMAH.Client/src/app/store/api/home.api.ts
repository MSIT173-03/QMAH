import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of } from 'rxjs';
import { apiUrl, getField, toParams } from './http';
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
  private readonly http = inject(HttpClient);

  /** GET /home/hero-slides：主視覺輪播 */
  getHeroSlides(): Observable<HeroSlide[]> {
    return getField<HeroSlide[]>(this.http, apiUrl('/home/hero-slides'), 'slides').pipe(
      // 行銷版位不是商品型錄核心資料；後端尚未提供時只隱藏該版位，保留首頁其他區塊。
      catchError(() => of<HeroSlide[]>([])),
    );
  }

  /** GET /home/flash-sale：限時特賣 */
  getFlashSale(): Observable<FlashSale> {
    return this.http.get<FlashSale>(apiUrl('/home/flash-sale')).pipe(
      catchError(() => of({ endsAt: '', items: [] })),
    );
  }

  /** GET /brands：品牌館 */
  getBrands(): Observable<Brand[]> {
    return getField<Brand[]>(this.http, apiUrl('/brands'), 'brands').pipe(catchError(() => of<Brand[]>([])));
  }

  /** GET /rankings：熱銷排行，依名次排列 */
  getRankings(query: RankingQuery = {}): Observable<Product[]> {
    return getField<Product[]>(this.http, apiUrl('/rankings'), 'items', query).pipe(catchError(() => of<Product[]>([])));
  }

  /** GET /recommendations：為你推薦（分頁，供「載入更多」逐頁取得） */
  getRecommendations(query: PageQuery = {}): Observable<Page<RecommendedProduct>> {
    return this.http.get<Page<RecommendedProduct>>(apiUrl('/recommendations'), {
      params: toParams(query),
    }).pipe(
      catchError(() => of({ items: [], total: 0, page: query.page ?? 1, pageSize: 0 })),
    );
  }

  /** GET /coupons/claimable：可領取的折價券 */
  getClaimableCoupons(): Observable<Coupon[]> {
    return getField<Coupon[]>(this.http, apiUrl('/coupons/claimable'), 'coupons').pipe(catchError(() => of<Coupon[]>([])));
  }
}
