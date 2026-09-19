import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  Observable,
  catchError,
  map,
  of,
  switchMap,
  tap
} from 'rxjs';

import { environment } from '../../../environments/environment';

export interface CurrentUser {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  pointBalance: number;
  roles: string[];
  createdAt: string;
  bio: string | null;
  visibility: string;
  avatarPath: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface AccountCapabilities {
  googleLoginEnabled: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly _currentUser =
    signal<CurrentUser | null>(null);

  readonly currentUser =
    this._currentUser.asReadonly();

  constructor(
    private http: HttpClient
  ) { }


  refreshAntiforgeryToken(): Observable<unknown> {

    return this.http.get(
      `${environment.apiBaseUrl}/account/antiforgery-token`
    );

  }


  getCurrentUser(): Observable<CurrentUser> {

    return this.http
      .get<CurrentUser>(
        `${environment.apiBaseUrl}/me`
      )
      .pipe(
        tap(user => {
          this._currentUser.set(user);
        })
      );

  }

  /** 讀取不含 secret 的選用登入能力；能力端點失敗時只關閉 Google，不影響密碼登入畫面。 */
  getCapabilities(): Observable<AccountCapabilities> {
    return this.http
      .get<AccountCapabilities>(`${environment.apiBaseUrl}/account/capabilities`)
      .pipe(catchError(() => of({ googleLoginEnabled: false })));
  }


  login(
    request: LoginRequest
  ): Observable<CurrentUser> {

    return this.refreshAntiforgeryToken()
      .pipe(

        switchMap(() =>
          this.http.post(
            `${environment.apiBaseUrl}/account/login`,
            request
          )
        ),

        switchMap(() =>
          this.getCurrentUser()
        ),

        switchMap(user =>
          this.refreshAntiforgeryToken()
            .pipe(

              switchMap(() =>
                this.http.post(
                  `${environment.apiBaseUrl}/me/daily-activity/login`,
                  {}
                )
              ),

              // integration: Daily Activity 是登入後的附加獎勵，不是建立登入狀態的必要條件；
              // cookie 與 /me 已成功時，即使該服務 timeout／5xx 也不能把使用者誤導回登入頁。
              catchError(() => of(null)),

              map(() => user)

            )
        )

      );

  }


  logout(): Observable<unknown> {

    return this.refreshAntiforgeryToken()
      .pipe(

        switchMap(() =>
          this.http.post(
            `${environment.apiBaseUrl}/account/logout`,
            {}
          )
        ),

        tap(() => {
          this._currentUser.set(null);
        })

      );

  }


  clearSession(): void {

    this._currentUser.set(null);

  }

}
