import { HttpErrorResponse } from '@angular/common/http';

/** 後端 ProblemDetails.detail 已是可直接顯示的說明；沒有時改用 fallback */
export function problemDetail(error: unknown, fallback: string): string {
  const detail = error instanceof HttpErrorResponse ? error.error?.detail : null;
  return typeof detail === 'string' && detail ? detail : fallback;
}
