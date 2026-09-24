import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { meUrl } from './http';
import { Coupon, MemberProfile, Recipient } from './api.models';

interface ApiMe {
  email: string;
  displayName: string | null;
  pointBalance: number;
}

/** GET /me/coupons 項目（後端 CouponDto 中商城用得到的欄位） */
interface ApiCoupon {
  id: string;
  name: string;
  /** PERCENT：discountValue 為折抵百分比（10 代表折 10%）；FIXED：discountValue 為折抵金額 */
  discountType: string;
  discountValue: number;
  minimumAmount: number;
  /** 後端已綜合 UserCoupon 狀態、到期日與活動區間；只有 AVAILABLE 可在結帳使用 */
  status: string;
  /** 活動結束時間（ISO 8601） */
  endAt: string;
  /** 會員持有券的到期時間（ISO 8601） */
  expiresAt: string;
}

/** GET /me/addresses 項目（後端 UserAddressDto 中結帳用得到的欄位） */
interface ApiAddress {
  recipientName: string;
  recipientPhone: string;
  postalCode: string | null;
  city: string | null;
  district: string | null;
  addressLine: string;
  isDefault: boolean;
}

/** 空白收件資訊；亦為結帳頁收件資訊表單的初始內容 */
export const EMPTY_RECIPIENT: Recipient = {
  name: '',
  phone: '',
  email: '',
  taxId: '',
  postalCode: '',
  city: '',
  district: '',
  address: '',
  note: '',
};

const EMPTY_PROFILE: MemberProfile = { ...EMPTY_RECIPIENT, pointBalance: 0 };

/** 會員 API */
@Injectable({ providedIn: 'root' })
export class MemberApi {
  private readonly http = inject(HttpClient);

  /** GET /me：會員資料（含點數餘額）；不含收件地址，結帳頁請改用 getCheckoutProfile */
  getProfile(): Observable<MemberProfile> {
    return this.http.get<ApiMe>(meUrl()).pipe(
      map((profile) => ({
        ...EMPTY_PROFILE,
        name: profile.displayName ?? '',
        email: profile.email,
        pointBalance: profile.pointBalance,
      })),
      catchError(() => of(EMPTY_PROFILE)),
    );
  }

  /**
   * GET /me + GET /me/addresses：結帳頁「帶入個人資料」用的會員資料與預設收件地址。
   * 有預設地址時以地址的收件人姓名／電話帶入；沒有地址或地址 API 失敗時只帶入暱稱與信箱。
   */
  getCheckoutProfile(): Observable<MemberProfile> {
    const addresses = this.http
      .get<ApiAddress[]>(meUrl('/addresses'))
      .pipe(catchError(() => of<ApiAddress[]>([])));
    return forkJoin([this.getProfile(), addresses]).pipe(
      map(([profile, list]) => {
        const address = list.find((item) => item.isDefault) ?? list[0];
        if (!address) return profile;
        return {
          ...profile,
          name: address.recipientName,
          phone: address.recipientPhone,
          postalCode: address.postalCode ?? '',
          city: address.city ?? '',
          district: address.district ?? '',
          address: address.addressLine,
        };
      }),
    );
  }

  /** GET /me/coupons：目前帳號持有且可使用的折價券（已使用、過期或未開始的券不列出） */
  getCoupons(): Observable<Coupon[]> {
    return this.http.get<ApiCoupon[]>(meUrl('/coupons')).pipe(
      map((coupons) => coupons.filter((coupon) => coupon.status === 'AVAILABLE').map((coupon) => {
        const isPercent = coupon.discountType.toUpperCase() === 'PERCENT';
        const value = Number(coupon.discountValue);
        // 會員券與活動其中一個先到期即失效，顯示較早的日期。
        const due = coupon.expiresAt < coupon.endAt ? coupon.expiresAt : coupon.endAt;
        return {
          id: coupon.id,
          // 與會員折價券頁一致：PERCENT 的 discountValue 是折抵百分比，不是折數。
          off: isPercent ? `${value}% OFF` : `NT$${value}`,
          title: coupon.name,
          cond: coupon.minimumAmount > 0 ? `最低消費 NT$${coupon.minimumAmount}` : '不限金額',
          min: coupon.minimumAmount,
          kind: isPercent ? 'percent' : 'amount',
          value: isPercent ? value / 100 : value,
          cap: null,
          due: due.slice(0, 10),
        } satisfies Coupon;
      })),
      catchError(() => of<Coupon[]>([])),
    );
  }
}
