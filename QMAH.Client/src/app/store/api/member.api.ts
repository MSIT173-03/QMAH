import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl, getField } from './http';
import { Coupon, MemberProfile } from './api.models';

/** 會員 API */
@Injectable({ providedIn: 'root' })
export class MemberApi {
  private readonly http = inject(HttpClient);

  /** GET /member/profile：會員資料（含點數餘額） */
  getProfile(): Observable<MemberProfile> {
    return this.http.get<MemberProfile>(apiUrl('/member/profile'));
  }

  /** GET /member/coupons：持有的折價券 */
  getCoupons(): Observable<Coupon[]> {
    return getField(this.http, apiUrl('/member/coupons'), 'coupons');
  }
}
