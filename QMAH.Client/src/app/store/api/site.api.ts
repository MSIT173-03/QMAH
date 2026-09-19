import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of } from 'rxjs';
import { apiUrl } from './http';
import { SiteConfig } from './api.models';

/** 全站設定 API */
@Injectable({ providedIn: 'root' })
export class SiteApi {
  private readonly http = inject(HttpClient);

  /** GET /site/config：公告列、頁尾、商品政策文案 */
  getConfig(): Observable<SiteConfig> {
    return this.http.get<SiteConfig>(apiUrl('/site/config')).pipe(
      // 全站文案尚未有正式 Store route 時採空設定，不能阻止商品頁或其他 Area 開啟。
      catchError(() =>
        of({ promoAnnouncements: [], footerColumns: [], productPolicies: [], sizeNote: '' }),
      ),
    );
  }
}
