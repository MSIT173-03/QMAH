import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  Observable,
  map,
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
