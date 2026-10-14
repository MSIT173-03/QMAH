import { inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  CanActivateFn,
  Router,
  RouterStateSnapshot
} from '@angular/router';
import {
  catchError,
  map,
  of
} from 'rxjs';

import {
  AuthService
} from '../auth/auth.service';

export const authGuard: CanActivateFn = (_route, state: RouterStateSnapshot) => {

  const authService =
    inject(AuthService);

  const router =
    inject(Router);

  return authService
    .getCurrentUser()
    .pipe(

      map(() => true),

      catchError((error: unknown) => {

        // 暫時壅塞不等於登入失效；僅沿用本次工作階段已確認的使用者。
        // 私人資料與寫入仍由伺服器驗證，401/403 絕不沿用舊狀態。
        if (error instanceof HttpErrorResponse
          && [0, 408, 429, 500, 502, 503, 504].includes(error.status)
          && authService.currentUser()) {
          return of(true);
        }

        authService.clearSession();

        // ui-integration: 會員、圖鑑與商城深層頁被攔下時保留原目的地，登入後才能回到原本流程，避免使用者被送回會員首頁後迷路。
        return of(router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } }));

      })

    );

};
