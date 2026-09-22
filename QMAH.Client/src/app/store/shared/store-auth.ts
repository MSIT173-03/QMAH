import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';

/**
 * 商城判斷登入狀態所需的三態：unknown 代表尚未向後端確認（或確認時遇到非 401 的錯誤），
 * authenticated／anonymous 則分別代表 GET /me 成功或回應 401。
 */
export type StoreAuthStatus = 'unknown' | 'authenticated' | 'anonymous';

/**
 * 商城的登入狀態：以 AuthService 驗證與保存目前會員，只在商城這一層補上「是否已確認過」的狀態，
 * 讓 AuthService.currentUser 為 null 時能區分「未登入」與「尚未確認」。
 * 登入（AuthService.login）、登出與 clearSession 都會更新 AuthService.currentUser，這裡的狀態隨之同步。
 */
@Injectable({ providedIn: 'root' })
export class StoreAuth {
  private readonly auth = inject(AuthService);

  /** 是否已向後端確認過登入狀態 */
  private readonly checked = signal(false);
  /** 進行中的確認；同一時間多個頁面或操作共用同一次 GET /me */
  private pending: Observable<void> | null = null;

  /** 目前的登入狀態 */
  readonly status = computed<StoreAuthStatus>(() => {
    if (this.auth.currentUser()) return 'authenticated';
    return this.checked() ? 'anonymous' : 'unknown';
  });

  /**
   * 確認登入狀態：已確認過時立即完成，否則透過 AuthService.getCurrentUser 查詢一次。
   * 401 代表未登入；其他錯誤（例如資料庫暫時不可用）維持 unknown，下次呼叫會再確認。
   */
  ensureLoaded(): Observable<void> {
    if (this.status() !== 'unknown') return of(undefined);

    this.pending ??= this.auth.getCurrentUser().pipe(
      map(() => this.checked.set(true)),
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401) this.markSignedOut();
        return of(undefined);
      }),
      finalize(() => (this.pending = null)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.pending;
  }

  /** 商城 API 回應 401（登入已失效）時呼叫：清除 AuthService 保存的會員，狀態轉為未登入 */
  markSignedOut(): void {
    this.auth.clearSession();
    this.checked.set(true);
  }
}
