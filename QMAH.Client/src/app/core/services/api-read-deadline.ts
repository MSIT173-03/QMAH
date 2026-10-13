import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { TimeoutError, catchError, throwError, timeout } from 'rxjs';

/** A stalled JSON read must reach the page's error/retry state instead of loading forever. */
export const apiReadDeadlineInterceptor: HttpInterceptorFn = (request, next) => {
  const response = next(request);
  if (request.method !== 'GET' || request.responseType !== 'json' || !request.url.startsWith('/api/')) return response;
  return response.pipe(
    timeout({ each: 15_000 }),
    catchError(error => throwError(() => error instanceof TimeoutError
      ? new HttpErrorResponse({ status: 504, statusText: '讀取逾時，請重新載入', url: request.url, error })
      : error)),
  );
};
