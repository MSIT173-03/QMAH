import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { CatalogModel, CatalogListResponse } from '../models/catalog-model';
import { catchError, Observable, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class CatalogService {
  private apiUrl = 'https://localhost:7249/api/v1/catalog/artifacts';

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

  /** 取得單一文物詳細資料 */
  getArtifactById(id: string): Observable<CatalogModel> {
    return this.http.get<CatalogModel>(`${this.apiUrl}/${id}`).pipe(
      catchError(this.handleError)
    );
  }


  // ========== 解鎖文物 ==========


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
