import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { apiUrl } from './http';
import { StoreCoupon, StoreCouponRedeemResult } from './api.models';

/** GET /store/coupons 項目（對應後端 StoreCouponDto） */
interface ApiStoreCoupon {
  id: string;
  name: string;
  /** PERCENT：discountValue 為折抵百分比（10 代表折 10%）；FIXED：discountValue 為折抵金額 */
  discountType: string;
  discountValue: number;
  minimumAmount: number;
  pointCost: number;
  validityDays: number;
  /** 可兌換期間的結束時間（ISO 8601） */
  endAt: string;
}

/** POST /store/coupons/{id}/redeem 回應（對應後端 StoreCouponRedeemResultDto） */
interface ApiRedeemResult {
  userCouponId: string;
  name: string;
  pointCost: number;
  remainingPoints: number;
  expiresAt: string;
}

/** 後端折價券定義轉為商城顯示用的模型；標示文字與會員折價券（MemberApi.getCoupons）保持一致 */
function toStoreCoupon(coupon: ApiStoreCoupon): StoreCoupon {
  const isPercent = coupon.discountType.toUpperCase() === 'PERCENT';
  const value = Number(coupon.discountValue);
  const min = Number(coupon.minimumAmount);
  return {
    id: coupon.id,
    title: coupon.name,
    off: isPercent ? `${value}% OFF` : `NT$${value}`,
    cond: min > 0 ? `最低消費 NT$${min}` : '不限金額',
    min,
    kind: isPercent ? 'percent' : 'amount',
    value: isPercent ? value / 100 : value,
    pointCost: coupon.pointCost,
    validityDays: coupon.validityDays,
    endDate: coupon.endAt.slice(0, 10),
  };
}

/** 折價券商店 API */
@Injectable({ providedIn: 'root' })
export class CouponApi {
  private readonly http = inject(HttpClient);

  /** GET /store/coupons：目前可用點數兌換的折價券（後端已篩選啟用、期間內且有兌換點數者），依所需點數由低到高 */
  getStoreCoupons(): Observable<StoreCoupon[]> {
    return this.http.get<ApiStoreCoupon[]>(apiUrl('/coupons')).pipe(map((coupons) => coupons.map(toStoreCoupon)));
  }

  /**
   * POST /store/coupons/{id}/redeem：以點數兌換一張折價券（需登入）。
   * 點數不足、折價券已不可兌換等情況後端回 409（ProblemDetails，detail 為可直接顯示的說明）。
   */
  redeemStoreCoupon(id: string): Observable<StoreCouponRedeemResult> {
    return this.http.post<ApiRedeemResult>(apiUrl`/coupons/${id}/redeem`, null).pipe(
      map((result) => ({
        name: result.name,
        pointCost: result.pointCost,
        remainingPoints: result.remainingPoints,
        expiresAt: result.expiresAt,
      })),
    );
  }
}
