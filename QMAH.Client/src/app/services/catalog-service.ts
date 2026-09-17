import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { CatalogModel, CatalogListResponse, CatalogDetailModel, CategoryModel, EraModel } from '../models/catalog-model';
import { catchError, map, Observable, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class CatalogService {
  private apiUrl = 'https://localhost:7249/api/v1/catalog/artifacts';
  private categoriesUrl = 'https://localhost:7249/api/v1/catalog/categories';
  private erasUrl = 'https://localhost:7249/api/v1/catalog/eras';

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

  /**
   * ⚠️ 防呆用：還沒完全確認 categories／eras 這兩支 API 回傳的是「直接一個陣列」
   * 還是外面包了一層（例如 { items: [...] }）。之前 key-list 懸停一直顯示 ID
   * 而不是名稱，很可能就是猜錯這個形狀，導致對照表其實是空的、每次查詢都落到
   * fallback（顯示原始 ID）。這裡兩種形狀都接得住，等你確認實際格式後，
   * 可以把這個方法拿掉，直接用 http.get<CategoryModel[]>() 就好。
   */
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
  // 解鎖相關 API 改由 KeyService.unlockWithKey() 負責（見 key-service.ts），
  // 打的是 POST /me/keys/{keyCode}/unlock，不是這支 catalog 底下的端點，這裡不重複定義。
  // （ArtifactUnlockService／artifact-unlock-service.ts 現在完全沒有任何呼叫者了，
  // 可以直接從專案裡刪除。）


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
      message = `伺服器錯誤 ${error.status}：${error.error?.message || error.statusText}`;
    }

    console.error(message);
    return throwError(() => new Error(message));
  }
}
