import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of } from 'rxjs';
import { apiUrl, getField } from './http';
import { Coupon, MemberProfile } from './api.models';

/** 會員 API */
@Injectable({ providedIn: 'root' })
export class MemberApi {
  private readonly http = inject(HttpClient);

  /** GET /member/profile：會員資料（含點數餘額） */
  getProfile(): Observable<MemberProfile> {
    return this.http.get<MemberProfile>(apiUrl('/member/profile')).pipe(
      // Store 專用會員 profile route 尚未存在；以中性資料維持頁面可讀，不虛構會員資產。
      catchError(() => of({ name: '', phone: '', email: '', taxId: '', address: '', note: '', pointBalance: 0 })),
    );
  }

  /** GET /member/coupons：持有的折價券 */
  getCoupons(): Observable<Coupon[]> {
    return getField<Coupon[]>(this.http, apiUrl('/member/coupons'), 'coupons').pipe(catchError(() => of<Coupon[]>([])));
  }
}
