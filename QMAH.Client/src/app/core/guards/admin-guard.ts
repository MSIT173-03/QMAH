import { inject } from '@angular/core';
import { CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { AuthService } from '../auth/auth.service';

/**
 * 前端只負責改善 Admin 入口與非管理員的導回體驗；實際授權仍由 Backend enforce。
 */
export const adminGuard: CanActivateFn = (_route, state: RouterStateSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.getCurrentUser().pipe(
    map((user) => user.roles?.includes('Admin')
      ? true
      : router.createUrlTree(['/home'])),
    catchError(() => {
      auth.clearSession();
      return of(router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } }));
    }),
  );
};
