import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from './toast';

/** 放在讀取重試外層，最後仍失敗才提示；不重送請求或攔截頁面的錯誤處理。 */
export const apiQueueFeedbackInterceptor: HttpInterceptorFn = (request, next) => {
  const toast = inject(ToastService);
  return next(request).pipe(catchError(error => {
    if (request.url.startsWith('/api/') && error instanceof HttpErrorResponse) {
      if (error.error?.code === 'queue_timeout') {
        toast.show('等待逾時，請重新整理或稍後再嘗試。', 'warning', 10_000);
      } else if (error.status === 504 && request.method === 'GET') {
        toast.show('讀取逾時，請重新整理或稍後再嘗試。', 'warning', 10_000);
      }
    }
    return throwError(() => error);
  }));
};
