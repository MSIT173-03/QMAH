import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

/** 商店 API 的網址前綴 */
const STORE_API_BASE = environment.apiBaseUrl + '/store';

// 這個前綴代表正式 Store API contract；每支 API 都應與後端既有 route／DTO 對照。

/**
 * 組出完整的 API 網址。
 * 可直接傳入路徑字串，或以標籤樣板（apiUrl`/products/${id}`）呼叫，樣板中的參數會自動以 encodeURIComponent 編碼。
 */
export function apiUrl(path: string | TemplateStringsArray, ...segments: string[]): string {
  const joined = typeof path === 'string' ? path : String.raw(path, ...segments.map(encodeURIComponent));
  return STORE_API_BASE + joined;
}

/** 將查詢參數物件轉為 HttpParams，略過未指定（undefined）的欄位 */
export function toParams(query: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params = params.set(key, String(value));
  }
  return params;
}

/** GET 回應為 { [key]: T } 的包裝物件時，直接取出其中的 key 欄位；query 會轉為查詢參數 */
export function getField<T>(http: HttpClient, url: string, key: string, query?: object): Observable<T> {
  return http
    .get<Record<string, T>>(url, query && { params: toParams(query) })
    .pipe(map((res) => res[key]));
}
