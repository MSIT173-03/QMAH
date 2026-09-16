import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router
} from '@angular/router';
import {
  catchError,
  map,
  of
} from 'rxjs';

import {
  AuthService
} from '../auth/auth.service';

export const authGuard: CanActivateFn = () => {

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

        return of(
          router.createUrlTree([
            '/login'
          ])
        );

      })

    );

};
