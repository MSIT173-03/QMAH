import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { SiteConfig } from './api.models';

/** 全站設定 API */
@Injectable({ providedIn: 'root' })
export class SiteApi {
  /** 後端尚未提供 Store site config，使用既有前端預設文案。 */
  getConfig(): Observable<SiteConfig> {
    return of({ promoAnnouncements: [], footerColumns: [], productPolicies: [], sizeNote: '' });
  }
}
