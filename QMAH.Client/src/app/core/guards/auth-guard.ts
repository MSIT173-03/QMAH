import { inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../auth/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.getCurrentUser().pipe(
    map(() => true),
    catchError((error: unknown) => {
      // A temporary outage may retain an already verified session. A 401/403
      // must always clear it; private reads and writes are still server-checked.
      if (error instanceof HttpErrorResponse
        && [0, 408, 429, 500, 502, 503, 504].includes(error.status)
        && authService.currentUser()) {
        return of(true);
      }

      authService.clearSession();
      return of(router.createUrlTree(['/login'], {
        queryParams: { returnUrl: state.url },
      }));
    }),
  );
};
