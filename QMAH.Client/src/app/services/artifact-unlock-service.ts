import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { CardEntry, ArtifactUnlockRecord, UnlockMethod, UnlockResult } from '../models/artifact-unlock-model';
import { CatalogListResponse } from '../models/catalog-model';

@Injectable({
  providedIn: 'root',
})
export class ArtifactUnlockService {
  // 沿用 catalog-service.ts 同一個 apiUrl：圖鑑清單本質上就是同一批 /catalog/artifacts 資料，
  // 差別只在於前端要額外疊上遊戲外皮與解鎖狀態，所以直接共用同一個 base，
  // 不要另外發明一個不存在的路徑（這是上一版出錯的原因）。
  private apiUrl = 'https://localhost:7249/api/v1/catalog/artifacts';

  constructor(private http: HttpClient) { }

  // ========== 圖鑑清單讀取 ==========

  /** 取得圖鑑清單。跟 CatalogService.getArtifacts() 打的是同一支 API，同一組分頁參數。 */
  getCompendium(page: number = 1, pageSize: number = 20): Observable<CatalogListResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    return this.http.get<CatalogListResponse>(this.apiUrl, { params }).pipe(
      catchError(this.handleError)
    );
  }

  /** 取得玩家目前持有的鑰匙數量 */
  getKeyBalance(): Observable<{ keys: number }> {
    return this.http.get<{ keys: number }>(`${this.apiUrl}/players/me/keys`).pipe(
      catchError(this.handleError)
    );
  }

  // ========== 解鎖文物 ==========
  // 對應 catalog-service.ts 裡原本預留、還沒實作的「解鎖文物」區塊。
  // ⚠️ 後端目前還沒有這支 API（catalog-service.ts 裡這段也是空的），
  // 下面先按 RESTful 慣例定義好前端要打的介面，等後端實作後路徑如有出入再調整。

  /**
   * 解鎖單一文物：由後端在同一交易內完成「扣鑰匙」＋ 寫入 ArtifactUnlocks 流水，
   * 成功後回傳更新後的物品、流水紀錄與剩餘鑰匙數。
   */
  unlockByKey(artifactId: string): Observable<UnlockResult> {
    return this.http
      .post<UnlockResult>(`${this.apiUrl}/${artifactId}/unlock`, {
        method: 'KEY' satisfies UnlockMethod,
      })
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
