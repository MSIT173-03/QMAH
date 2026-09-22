import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { CatalogModel, CatalogListResponse, CatalogDetailModel, CategoryModel, EraModel } from '../models/catalog-model';
import { ArtifactUnlockRecord } from '../models/artifact-unlock-model';
import { catchError, map, of, switchMap, Observable, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

/** 對應後端 ApiPage&lt;T&gt; 的分頁包裝，跟 CatalogListResponse 是同一套形狀 */
interface ApiPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}


function extractServerErrorDetail(error: any): string {
  const body = error?.error;
  if (!body) return error?.statusText || '未知錯誤';
  if (typeof body === 'string') return body;

  if (body.errors && typeof body.errors === 'object') {
    const parts = Object.entries(body.errors as Record<string, unknown>).map(
      ([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join('; ') : msgs}`
    );
    if (parts.length > 0) return parts.join(' | ');
  }

  return body.message || body.title || body.detail || error?.statusText || '未知錯誤';
}

@Injectable({
  providedIn: 'root',
})
export class CatalogService {
  // integration: 所有 Catalog 請求都沿用共用 API base URL，避免把 localhost host
  // 寫死在正式 Client，並讓 app.config 的 Cookie/XSRF interceptor 能統一處理登入請求。
  private apiUrl = `${environment.apiBaseUrl}/catalog/artifacts`;
  private categoriesUrl = `${environment.apiBaseUrl}/catalog/categories`;
  private erasUrl = `${environment.apiBaseUrl}/catalog/eras`;
  private myUnlocksUrl = `${environment.apiBaseUrl}/me/catalog/unlocks`;

  constructor(private http: HttpClient) { }

  // ========== 文物讀取（Read）==========

  /** 取得分頁列表 */
  getArtifacts(page: number = 1, pageSize: number = 20): Observable<CatalogListResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    return this.http.get<CatalogListResponse>(this.apiUrl, { params }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * 取得單一文物「完整」詳細資料。
   * 回傳型別是 CatalogDetailModel，不是 CatalogModel——
   * 這支 API 實際上多回傳了 description / sizeText / primaryImagePath /
   * eraTextOriginal / creatorDisplay / licenseCode / attributionText 等
   * 清單 API 沒有的欄位。
   */
  getArtifactById(id: string): Observable<CatalogDetailModel> {
    return this.http.get<CatalogDetailModel>(`${this.apiUrl}/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  // ========== 分類／年代對照 ==========

  /** 取得分類對照清單（id → 顯示名稱），key-list 的分類鑰匙提示要用 */
  getCategories(): Observable<CategoryModel[]> {
    return this.http.get<unknown>(this.categoriesUrl).pipe(
      map((res) => this.toArray<CategoryModel>(res, 'getCategories')),
      catchError(this.handleError)
    );
  }

  /** 取得年代對照清單（id → 顯示名稱），key-list 的年代鑰匙提示要用 */
  getEras(): Observable<EraModel[]> {
    return this.http.get<unknown>(this.erasUrl).pipe(
      map((res) => this.toArray<EraModel>(res, 'getEras')),
      catchError(this.handleError)
    );
  }


  private toArray<T>(res: unknown, callerLabel: string): T[] {
    if (Array.isArray(res)) return res;

    if (res && typeof res === 'object') {
      const obj = res as Record<string, unknown>;
      const candidate = obj['items'] ?? obj['data'] ?? obj['results'];
      if (Array.isArray(candidate)) return candidate as T[];
    }

    console.warn(`[CatalogService] ${callerLabel} 收到無法辨識的清單格式，視為空清單：`, res);
    return [];
  }


  // ========== 解鎖文物 ==========
  getMyArtifactUnlocks(): Observable<ArtifactUnlockRecord[]> {
    return this.fetchAllUnlockPages(1, []);
  }

  private fetchAllUnlockPages(page: number, acc: ArtifactUnlockRecord[]): Observable<ArtifactUnlockRecord[]> {
    const bulkPageSize = 100;
    const params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', bulkPageSize.toString());

    return this.http.get<ApiPage<ArtifactUnlockRecord>>(this.myUnlocksUrl, { params }).pipe(
      switchMap((res) => {
        const combined = [...acc, ...res.items];
        return page < res.totalPages ? this.fetchAllUnlockPages(page + 1, combined) : of(combined);
      }),
      catchError(this.handleError)
    );
  }


  // ========== 新增（Create）==========

  /** 新增一筆文物資料 */
  createArtifact(artifact: Omit<CatalogModel, 'id'>): Observable<CatalogModel> {
    return this.http.post<CatalogModel>(this.apiUrl, artifact).pipe(
      catchError(this.handleError)
    );
  }

  // ========== 修改（Update）==========

  /** 完整覆蓋更新（PUT）：必須帶齊所有欄位 */
  updateArtifact(id: string, artifact: Omit<CatalogModel, 'id'>): Observable<CatalogModel> {
    return this.http.put<CatalogModel>(`${this.apiUrl}/${id}`, artifact).pipe(
      catchError(this.handleError)
    );
  }

  /** 局部更新（PATCH）：只送要修改的欄位 */
  patchArtifact(id: string, changes: Partial<CatalogModel>): Observable<CatalogModel> {
    return this.http.patch<CatalogModel>(`${this.apiUrl}/${id}`, changes).pipe(
      catchError(this.handleError)
    );
  }

  // ========== 刪除（Delete）==========

  /** 刪除單筆文物 */
  deleteArtifact(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  /** 批次刪除多筆（依實際 API 設計而定，這裡示範帶 body 的 DELETE） */
  deleteArtifacts(ids: string[]): Observable<void> {
    return this.http.delete<void>(this.apiUrl, { body: { ids } }).pipe(
      catchError(this.handleError)
    );
  }

  // ========== 共用錯誤處理 ==========

  private handleError(error: any) {
    let message = '發生未知錯誤';

    if (error.error instanceof ErrorEvent) {
      // 前端或網路層錯誤（如斷網）
      message = `網路錯誤：${error.error.message}`;
    } else {
      // 後端回傳的錯誤（HTTP status code 非 2xx）
      message = `伺服器錯誤 ${error.status}：${extractServerErrorDetail(error)}`;
    }

    console.error(message, error);
    return throwError(() => new Error(message));
  }
}
