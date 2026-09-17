import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import { KeyModel, UnlockWithKeyRequest, UnlockWithKeyResult } from '../models/key-model';

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
  // 沿用 economy.ts 實際打的路徑（相對路徑，沒有 https://localhost:7249 前綴）
  private apiUrl = '/api/v1/me/economy';

  constructor(private http: HttpClient) { }

  /** 取得玩家背包內持有的所有鑰匙；實際上是打 economy 這支綜合 API，只取其中的 keys 陣列 */
  getKeys(): Observable<KeyModel[]> {
    return this.http.get<EconomyResponse>(this.apiUrl).pipe(
      map((res) => res.keys),
      catchError(this.handleError)
    );
  }

  /**
   * 使用一把鑰匙進行解鎖。
   * - 一般／年代／分類鑰匙：不用帶 artifactId，後端會隨機挑一個符合條件、尚未解鎖的文物。
   * - 萬能鑰匙：要帶 artifactId，指定玩家在圖鑑頁選中的那個文物
   *   （呼叫端是 artifact-list.ts 的解鎖按鈕，不是 key-list 的鑰匙格子）。
   */
  unlockWithKey(keyCode: string, artifactId?: string): Observable<UnlockWithKeyResult> {
    const body: UnlockWithKeyRequest = artifactId ? { artifactId } : {};
    return this.http
      .post<UnlockWithKeyResult>(
        `https://localhost:7249/api/v1/me/keys/${encodeURIComponent(keyCode)}/unlock`,
        body
      )
      .pipe(catchError(this.handleError));
  }

  // ========== 共用錯誤處理（與 catalog-service.ts 相同寫法）==========

  private handleError(error: any) {
    let message = '發生未知錯誤';

    if (error.error instanceof ErrorEvent) {
      message = `網路錯誤：${error.error.message}`;
    } else {
      message = `伺服器錯誤 ${error.status}：${error.error?.message || error.statusText}`;
    }

    console.error(message);
    return throwError(() => new Error(message));
  }
}
