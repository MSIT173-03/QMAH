import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { CatalogModel, CatalogListResponse, CatalogDetailModel, CategoryModel, EraModel } from '../models/catalog-model';
import { ArtifactUnlockRecord } from '../models/artifact-unlock-model';
import { catchError, map, of, switchMap, Observable, throwError } from 'rxjs';

/** 對應後端 ApiPage&lt;T&gt; 的分頁包裝，跟 CatalogListResponse 是同一套形狀 */
interface ApiPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

/**
 * 嘗試從後端錯誤回應的 body 讀出比 statusText 更精確的錯誤原因，寫法與理由
 * 跟 key-service.ts 的同名函式一致（含「為什麼是 class 外的純函式、不是
 * this.xxx() 方法」那段說明——handleError 是用 catchError(this.handleError)
 * 這種「傳函式參照」的寫法接進 pipe 的，呼叫時會遺失 this 綁定）。
 */
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
  private apiUrl = 'https://localhost:7249/api/v1/catalog/artifacts';
  private categoriesUrl = 'https://localhost:7249/api/v1/catalog/categories';
  private erasUrl = 'https://localhost:7249/api/v1/catalog/eras';
  // ⚠️ 這支是 /me/... 底下需要驗證身份的端點，改成相對路徑、比照 key-service.ts 的
  // economy 端點走 dev server proxy，不要像上面幾支 catalog 公開資料一樣打絕對網址——
  // 瀏覽器對 https://localhost:7249 是跨來源請求，Cookie／驗證資訊不會自動帶上去，
  // 這是先前 401 的原因。
  //
  // ⚠️ 路徑目前是第三次猜測：/me/catalog/artifact/unlocks（404）→ /me/unlocks（404，
  // GetUnlocks() 顯然不在跟 UnlockArtifact() 同一層路由前綴下）→ 這次改成
  // /me/catalog/unlocks。還沒有實際文件或 log 證實過，如果還是 404，
  // 麻煩去 Scalar API 文件（或 OpenAPI JSON）查一次實際路徑，不要再繼續用猜的。
  private myUnlocksUrl = '/api/v1/me/catalog/unlocks';

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
  // 「執行」解鎖的 API 改由 KeyService.unlockWithKey() 負責（見 key-service.ts），
  // 打的是 POST /me/keys/{keyCode}/unlock，不是這支 catalog 底下的端點，這裡不重複定義。
  // （ArtifactUnlockService／artifact-unlock-service.ts 現在完全沒有任何呼叫者了，
  // 可以直接從專案裡刪除。）

  /**
   * 取得目前登入玩家「已解鎖」的文物清單，用來在圖鑑清單畫面把每張卡片的
   * unlocked／unlockedAt 補成真實值，不再用 toCardSummary() 裡的
   * unlocked: false 佔位假資料。
   *
   * ⚠️ 這支是分頁 API（GET /me/unlocks，預設 pageSize=20，回應形狀是
   * { items, page, pageSize, totalCount, totalPages }，跟 getArtifacts() 的
   * CatalogListResponse 同一套包裝），不是一次回全部——玩家解鎖數量一旦超過
   * 一頁，只打一次就會漏資料，所以這裡依 totalPages 把所有分頁都抓完再合併回傳，
   * 寫法比照 artifact-list.ts 的 fetchAllPages()。
   */
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
