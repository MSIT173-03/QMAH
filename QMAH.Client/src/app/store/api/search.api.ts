import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { HotSearchLink, KeywordSuggestion } from './api.models';

/** 搜尋 API */
@Injectable({ providedIn: 'root' })
export class SearchApi {
  /** 後端沒有熱門搜尋的 API，回傳空清單（搜尋框因此不顯示熱門搜尋連結）。 */
  getHotLinks(): Observable<HotSearchLink[]> {
    return of<HotSearchLink[]>([]);
  }

  /** 後端沒有搜尋建議的 API，回傳空清單（搜尋框因此不顯示建議下拉）。 */
  getSuggestions(q: string): Observable<KeywordSuggestion[]> {
    return of<KeywordSuggestion[]>([]);
  }
}
