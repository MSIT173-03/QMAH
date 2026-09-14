import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { apiUrl, toParams } from './http';
import { HotSearchLink, KeywordSuggestion } from './api.models';

/** 搜尋 API */
@Injectable({ providedIn: 'root' })
export class SearchApi {
  private readonly http = inject(HttpClient);

  /** GET /search/hot-links：熱門搜尋捷徑 */
  getHotLinks(): Observable<HotSearchLink[]> {
    return this.http
      .get<{ links: HotSearchLink[] }>(apiUrl('/search/hot-links'))
      .pipe(map((res) => res.links));
  }

  /** GET /search/suggestions：依輸入中的關鍵字取得搜尋建議 */
  getSuggestions(q: string): Observable<KeywordSuggestion[]> {
    return this.http
      .get<{ suggestions: KeywordSuggestion[] }>(apiUrl('/search/suggestions'), {
        params: toParams({ q }),
      })
      .pipe(map((res) => res.suggestions));
  }
}
