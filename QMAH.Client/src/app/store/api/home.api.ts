import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl, getField } from './http';
import {
  Coupon,
  FlashSale,
  HeroSlide,
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

  /** GET /coupons/claimable：可領取的折價券 */
  getClaimableCoupons(): Observable<Coupon[]> {
    return getField(this.http, apiUrl('/coupons/claimable'), 'coupons');
  }
}
