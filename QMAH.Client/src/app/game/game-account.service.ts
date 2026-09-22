import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, of, switchMap, tap, throwError } from 'rxjs';

import { environment } from '../../environments/environment';

export interface GameAccountSession {
  userId: string;
  email: string;
  nickname: string | null;
}

@Injectable({ providedIn: 'root' })
export class GameAccountService {
  private readonly http = inject(HttpClient);
  private readonly accountUrl = `${environment.apiBaseUrl}/account`;
  private readonly accountState = signal<GameAccountSession | null>(null);

  readonly account = this.accountState.asReadonly();

  loadCurrentAccount(): Observable<GameAccountSession | null> {
    return this.http.get<GameAccountSession>(`${this.accountUrl}/me`).pipe(
      tap((account) => this.accountState.set(account)),
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
          this.accountState.set(null);
          return of(null);
        }
        return throwError(() => error);
      })
    );
  }

  logout(): Observable<void> {
    return this.getAntiforgeryToken().pipe(
      switchMap(() => this.http.post<void>(`${this.accountUrl}/logout`, null)),
      tap(() => this.accountState.set(null))
    );
  }

  private getAntiforgeryToken(): Observable<void> {
    return this.http.get<void>(`${this.accountUrl}/antiforgery-token`);
  }
}
