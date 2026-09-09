import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { environment } from '../../../environments/environment';

export const authGuard: CanActivateFn = () => {
  const http = inject(HttpClient);
  const router = inject(Router);

  return http.get(`${environment.apiBaseUrl}/me`).pipe(
    map(() => true),

    catchError(() => {
      return of(router.createUrlTree(['/login']));
    })
  );
};
