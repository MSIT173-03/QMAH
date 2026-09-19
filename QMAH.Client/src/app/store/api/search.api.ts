import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of } from 'rxjs';
import { apiUrl, getField } from './http';
import { HotSearchLink, KeywordSuggestion } from './api.models';

/** 搜尋 API */
@Injectable({ providedIn: 'root' })
export class SearchApi {
  private readonly http = inject(HttpClient);

  /** GET /search/hot-links：熱門搜尋捷徑 */
  getHotLinks(): Observable<HotSearchLink[]> {
    return getField<HotSearchLink[]>(this.http, apiUrl('/search/hot-links'), 'links').pipe(catchError(() => of<HotSearchLink[]>([])));
  }

  /** GET /search/suggestions：依輸入中的關鍵字取得搜尋建議 */
  getSuggestions(q: string): Observable<KeywordSuggestion[]> {
    return getField<KeywordSuggestion[]>(this.http, apiUrl('/search/suggestions'), 'suggestions', { q }).pipe(
      catchError(() => of<KeywordSuggestion[]>([])),
    );
  }
}
