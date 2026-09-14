import { HttpParams } from '@angular/common/http';
import { environment } from "./index"

/** 組出完整的 API 網址 */
export function apiUrl(path: string): string {
  return environment.apiBaseUrl + "/store" + path;
}

/** 將查詢參數物件轉為 HttpParams，略過未指定（undefined）的欄位 */
export function toParams(query: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params = params.set(key, String(value));
  }
  return params;
}
