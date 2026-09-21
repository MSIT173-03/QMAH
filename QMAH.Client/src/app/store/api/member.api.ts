import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Coupon, MemberProfile } from './api.models';

interface ApiMe {
  email: string;
  displayName: string | null;
  pointBalance: number;
}

interface ApiCoupon {
  id: string;
  name: string;
  discountType: string;
  discountValue: number;
  minimumAmount: number;
  expiresAt: string;
}

const EMPTY_PROFILE: MemberProfile = {
  name: '', phone: '', email: '', taxId: '', address: '', note: '', pointBalance: 0,
};

/** 會員 API */
@Injectable({ providedIn: 'root' })
export class MemberApi {
  private readonly http = inject(HttpClient);

  /** GET /me：會員資料（含點數餘額） */
  getProfile(): Observable<MemberProfile> {
    return this.http.get<ApiMe>(`${environment.apiBaseUrl}/me`).pipe(
      map((profile) => ({
        ...EMPTY_PROFILE,
        name: profile.displayName ?? '',
        email: profile.email,
        pointBalance: profile.pointBalance,
      })),
      catchError(() => of(EMPTY_PROFILE)),
    );
  }

  /** GET /me/coupons：目前帳號持有的折價券 */
  getCoupons(): Observable<Coupon[]> {
    return this.http.get<ApiCoupon[]>(`${environment.apiBaseUrl}/me/coupons`).pipe(
      map((coupons) => coupons.map((coupon) => {
        const isPercent = coupon.discountType.toUpperCase() === 'PERCENT';
        const value = Number(coupon.discountValue);
        return {
          id: coupon.id,
          off: isPercent ? `${100 - value}%` : `NT$${value}`,
          title: coupon.name,
          cond: coupon.minimumAmount > 0 ? `最低消費 NT$${coupon.minimumAmount}` : '不限金額',
          min: coupon.minimumAmount,
          kind: isPercent ? 'percent' : 'amount',
          value: isPercent ? value / 100 : value,
          cap: null,
          due: coupon.expiresAt?.slice(0, 10) ?? null,
        } satisfies Coupon;
      })),
      catchError(() => of<Coupon[]>([])),
    );
  }
}
