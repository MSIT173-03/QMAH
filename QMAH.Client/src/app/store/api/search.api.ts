import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { HotSearchLink, KeywordSuggestion } from './api.models';

/** 搜尋 API */
@Injectable({ providedIn: 'root' })
export class SearchApi {
  /** 後端尚未提供熱門搜尋捷徑，首頁仍可使用商品清單搜尋。 */
  getHotLinks(): Observable<HotSearchLink[]> {
    return of<HotSearchLink[]>([]);
  }

  /** 後端尚未提供搜尋建議，避免每次輸入都打不存在的 route。 */
  getSuggestions(q: string): Observable<KeywordSuggestion[]> {
    return of<KeywordSuggestion[]>([]);
  }
}
