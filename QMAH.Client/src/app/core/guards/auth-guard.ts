import { inject } from '@angular/core';
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

      catchError(() => {

        authService.clearSession();

        // ui-integration: 會員、圖鑑與商城深層頁被攔下時保留原目的地，登入後才能回到原本流程，避免使用者被送回會員首頁後迷路。
        return of(router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } }));

      })

    );

};
