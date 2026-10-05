import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { SiteConfig } from './api.models';

/** 全站設定 API */
@Injectable({ providedIn: 'root' })
export class SiteApi {
  /** 後端沒有商城全站設定的 API，回傳空設定（公告改由優惠活動提供，商品政策與尺寸說明為空）。 */
  getConfig(): Observable<SiteConfig> {
    return of({ promoAnnouncements: [], productPolicies: [], sizeNote: '' });
  }
}
