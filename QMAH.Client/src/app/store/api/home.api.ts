import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
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
    return getField(this.http, apiUrl('/home/hero-slides'), 'slides');
  }

  /** GET /home/flash-sale：限時特賣 */
  getFlashSale(): Observable<FlashSale> {
    return this.http.get<FlashSale>(apiUrl('/home/flash-sale'));
  }

  /** GET /brands：品牌館 */
  getBrands(): Observable<Brand[]> {
    return getField(this.http, apiUrl('/brands'), 'brands');
  }

  /** GET /rankings：熱銷排行，依名次排列 */
  getRankings(query: RankingQuery = {}): Observable<Product[]> {
    return getField(this.http, apiUrl('/rankings'), 'items', query);
  }

  /** GET /recommendations：為你推薦（分頁，供「載入更多」逐頁取得） */
  getRecommendations(query: PageQuery = {}): Observable<Page<RecommendedProduct>> {
    return this.http.get<Page<RecommendedProduct>>(apiUrl('/recommendations'), {
      params: toParams(query),
    });
  }

  /** GET /coupons/claimable：可領取的折價券 */
  getClaimableCoupons(): Observable<Coupon[]> {
    return getField(this.http, apiUrl('/coupons/claimable'), 'coupons');
  }
}
