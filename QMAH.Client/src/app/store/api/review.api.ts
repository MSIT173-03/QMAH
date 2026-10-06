import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { apiUrl } from './http';
import { Review } from './api.models';
import { ApiProductReview, toReview } from './catalog.api-dto';

/** 送出評價的內容 */
export interface ReviewDraft {
  /** 星等（1–5） */
  rating: number;
  content: string;
}

/** 目前登入會員自己的商品評價 API（同一會員對同一商品只有一則評價） */
@Injectable({ providedIn: 'root' })
export class ReviewApi {
  private readonly http = inject(HttpClient);

  /** GET /store/products/{id}/reviews/me：會員對商品的評價；還沒評價時後端回 404，這裡轉成 null */
  getMyReview(productId: string): Observable<Review | null> {
    return this.http.get<ApiProductReview>(apiUrl`/products/${productId}/reviews/me`).pipe(
      map(toReview),
      catchError((error: unknown) =>
        error instanceof HttpErrorResponse && error.status === 404 ? of(null) : throwError(() => error),
      ),
    );
  }

  /** PUT /store/products/{id}/reviews/me：新增評價；已有評價時改為修改（後端會更新修改時間），回傳儲存後的評價 */
  saveMyReview(productId: string, draft: ReviewDraft): Observable<Review> {
    return this.http
      .put<ApiProductReview>(apiUrl`/products/${productId}/reviews/me`, {
        rating: draft.rating,
        content: draft.content,
      })
      .pipe(map(toReview));
  }
}
