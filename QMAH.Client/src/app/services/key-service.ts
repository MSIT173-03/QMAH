import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import { KeyExchangeResult, KeyModel, KeyExchangeRule, UnlockWithKeyRequest, UnlockWithKeyResult } from '../models/key-model';
import { environment } from '../../environments/environment';

/**
 * 嘗試從後端錯誤回應的 body 讀出比 statusText 更精確的錯誤原因。
 * ASP.NET Core 預設的驗證錯誤格式（ValidationProblemDetails）通常長這樣：
 *   { title: "...", status: 400, errors: { ArtifactId: ["The ArtifactId field is required."] } }
 * 這裡依序嘗試 errors／message／title／detail 這幾個常見欄位，抓到就顯示，抓不到才
 * fallback 回 statusText。等實際看到 400 回應長怎樣，可以換成直接對應正確的欄位。
 *
 * ⚠️ 寫成 class 外的純函式、不是 KeyService 的方法：handleError 是用
 * catchError(this.handleError) 這種「傳函式參照」的寫法接進 pipe 的，RxJS 實際呼叫時
 * 會遺失 this 綁定，如果這裡也宣告成 this.extractServerErrorDetail() 會直接噴
 * "Cannot read properties of undefined"（上一版就是這樣壞的）。
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

/**
 * 後端沒有單獨拆出來的「只回傳鑰匙」端點（打 /api/v1/me/keys 會 404），
 * 鑰匙清單其實包在 economy.ts 也在用的這支綜合 API 裡，這裡只取用 keys 那一塊，
 * pointBalance／keyProgress* 這兩個欄位跟 key-list 無關，型別上還是宣告出來，
 * 純粹是因為它們也在同一個 API 回應裡，不代表這個 service 會用到它們。
 */
interface EconomyResponse {
  pointBalance: number;
  keyProgressBalance: number;
  keyProgressToNormalKey: number;
  keys: KeyModel[];
}

@Injectable({
  providedIn: 'root',
})
export class KeyService {
  // integration: 鑰匙資料與解鎖請求共用 environment API base URL，確保不同環境不會
  // 綁死 localhost，也讓 Identity Cookie 由全域 HttpClient interceptor 統一帶入。
  private apiUrl = `${environment.apiBaseUrl}/me/economy`;
  private exchangeRulesUrl = `${environment.apiBaseUrl}/me/keys/exchange-rules`;

  constructor(private http: HttpClient) { }

  /** 取得玩家背包內持有的所有鑰匙；實際上是打 economy 這支綜合 API，只取其中的 keys 陣列 */
  getKeys(): Observable<KeyModel[]> {
    return this.http.get<EconomyResponse>(this.apiUrl).pipe(
      map((res) => res.keys),
      catchError(this.handleError)
    );
  }

  /**
   * 取得鑰匙兌換／解鎖規則：每種鑰匙（NORMAL／CATEGORY／ERA／UNIVERSAL）
   * 解鎖一次要消耗幾把。key-list.ts 用來顯示、檢查各類鑰匙實際要消耗的數量；
   * artifact-list.ts 用來取代原本寫死的「萬能鑰匙固定消耗 1 把」。
   *
   * ⚠️ 沒有實際回應可以對照，防呆方式比照 catalog-service.ts 的 getCategories()／
   * getEras()：不確定外層是不是直接一個陣列，兩種都接得住（見 toArray()）；
   * 另外也不確定每筆規則的欄位到底叫 costPerUnlock，還是 cost／requiredCount／
   * keyCost 之類的名字，parseExchangeRule() 多猜了幾個常見命名，抓不到就 fallback
   * 成 1。等你把實際回應貼給我，可以把這兩層防呆都拿掉，直接用 http.get<KeyExchangeRule[]>()。
   */
  getExchangeRules(): Observable<KeyExchangeRule[]> {
    return this.http.get<unknown>(this.exchangeRulesUrl).pipe(
      map((res) => this.toArray<Record<string, unknown>>(res, 'getExchangeRules').map((raw) => this.parseExchangeRule(raw))),
      catchError(this.handleError)
    );
  }

  private parseExchangeRule(raw: Record<string, unknown>): KeyExchangeRule {
    return {
      id: String(raw['id'] ?? ''),
      sourceKeyCode: String(raw['sourceKeyCode'] ?? ''),
      sourceKeyName: String(raw['sourceKeyName'] ?? '來源鑰匙'),
      sourceAmount: Number(raw['sourceAmount'] ?? 0),
      targetKeyCode: String(raw['targetKeyCode'] ?? ''),
      targetKeyName: String(raw['targetKeyName'] ?? '目標鑰匙'),
      targetAmount: Number(raw['targetAmount'] ?? 0),
      targetEligibleArtifactCount: Number(raw['targetEligibleArtifactCount'] ?? 0),
      description: typeof raw['description'] === 'string' ? raw['description'] : null,
    };
  }

  exchangeKeys(ruleId: string, units = 1): Observable<KeyExchangeResult> {
    return this.http.post<KeyExchangeResult>(`${environment.apiBaseUrl}/me/keys/exchange`, { ruleId, units }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * ⚠️ 跟 catalog-service.ts 裡同名方法一樣的防呆邏輯（不確定後端是直接回一個陣列，
   * 還是外面包了一層），兩邊各放一份是因為目前專案沒有共用的 util 模組；
   * 如果之後想去重，可以抽到共用檔案讓兩個 service 一起用。
   */
  private toArray<T>(res: unknown, callerLabel: string): T[] {
    if (Array.isArray(res)) return res;

    if (res && typeof res === 'object') {
      const obj = res as Record<string, unknown>;
      const candidate = obj['items'] ?? obj['data'] ?? obj['results'] ?? obj['rules'];
      if (Array.isArray(candidate)) return candidate as T[];
    }

    console.warn(`[KeyService] ${callerLabel} 收到無法辨識的清單格式，視為空清單：`, res);
    return [];
  }

  /**
   * 使用一把鑰匙進行解鎖。
   * - 一般／年代／分類鑰匙：不帶 artifactId 參數（body 送 { artifactId: null }），後端會
   *   隨機挑一個符合條件、尚未解鎖的文物。
   * - 萬能鑰匙：帶 artifactId，指定玩家在圖鑑頁選中的那個文物
   *   （呼叫端是 artifact-list.ts 的解鎖按鈕，不是 key-list 的鑰匙格子）。
   */
  unlockWithKey(keyCode: string, artifactId?: string): Observable<UnlockWithKeyResult> {
    const body: UnlockWithKeyRequest = { artifactId: artifactId ?? null };
    return this.http
      .post<UnlockWithKeyResult>(
        `${environment.apiBaseUrl}/me/keys/${encodeURIComponent(keyCode)}/unlock`,
        body
      )
      .pipe(catchError(this.handleError));
  }

  // ========== 共用錯誤處理（與 catalog-service.ts 相同寫法）==========

  /**
   * ⚠️ 這裡刻意呼叫外面的純函式 extractServerErrorDetail()，不是 this.extractServerErrorDetail()：
   * handleError 是用 catchError(this.handleError) 這種「傳函式參照」的寫法接進 pipe 的，
   * RxJS 實際呼叫時會遺失 this 綁定，handleError 內部這時候的 this 是 undefined。
   * 原本沒事是因為 handleError 從來沒用到 this；上一版我加了 this.extractServerErrorDetail()
   * 才踩到這個坑（"Cannot read properties of undefined" 就是這樣來的，也因此把後端
   * 真正的 400 錯誤內容蓋掉了）。改成呼叫外部純函式後就不依賴 this，不用另外處理綁定。
   */
  private handleError(error: any) {
    let message = '發生未知錯誤';

    if (error.error instanceof ErrorEvent) {
      message = `網路錯誤：${error.error.message}`;
    } else {
      message = `伺服器錯誤 ${error.status}：${extractServerErrorDetail(error)}`;
    }

    console.error(message, error);
    return throwError(() => new Error(message));
  }
}
