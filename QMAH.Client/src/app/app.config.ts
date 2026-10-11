import {
  HttpInterceptorFn,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
  withXsrfConfiguration
} from '@angular/common/http';

import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners
} from '@angular/core';

import {
  ActivatedRouteSnapshot,
  provideRouter,
  withComponentInputBinding,
  withViewTransitions
} from '@angular/router';


import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { finalize, retry, throwError, timer } from 'rxjs';
import { PageReadiness } from './core/services/page-readiness';

const pageReadinessInterceptor: HttpInterceptorFn = (request, next) => {
  const ready = inject(PageReadiness);
  const isApi = request.url.startsWith(environment.apiBaseUrl);
  const complete = isApi ? ready.track(request.url, request.method) : () => undefined;
  return next(request).pipe(
    retry({ count: 2, delay: (error: unknown, attempt) => {
      if (!isApi || request.method !== 'GET' || !(error instanceof HttpErrorResponse) || ![0, 408, 429, 502, 503, 504].includes(error.status)) return throwError(() => error);
      const seconds = Number(error.headers.get('Retry-After'));
      const delay = seconds > 0 ? Math.min(seconds * 1000, 5000) : 800 * 2 ** (attempt - 1);
      return timer(delay + Math.floor(Math.random() * 250));
    } }),
    finalize(complete),
  );
};

function gameMode(route: ActivatedRouteSnapshot): 'multiplayer' | 'training' | 'guide' | null {
  const path = `/${route.pathFromRoot.flatMap(snapshot => snapshot.url.map(segment => segment.path)).filter(Boolean).join('/')}`;
  if (path === '/game' || path === '/game/rooms' || path.startsWith('/game/room/')) return 'multiplayer';
  if (path === '/game/training' || path === '/game/minigames') return 'training';
  if (path === '/game/how-to') return 'guide';
  return null;
}

// API 使用 Identity cookie 維持登入狀態；集中設定 credentials，避免各服務自行重複處理。
const apiCredentialsInterceptor: HttpInterceptorFn = (request, next) => {
  const isApiRequest = request.url.startsWith(environment.apiBaseUrl);

  return next(
    isApiRequest
      ? request.clone({ withCredentials: true })
      : request
  );
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(() => { inject(PageReadiness); }),
    provideBrowserGlobalErrorListeners(),

    provideRouter(
      routes,
      withComponentInputBinding(),
      withViewTransitions({
        skipInitialTransition: true,
        onViewTransitionCreated: ({ from, to, transition }) => {
          const previousMode = gameMode(from);
          if (!previousMode || previousMode !== gameMode(to)) {
            // 主動略過的轉場會讓這三個 promise 以 AbortError 拒絕；這是預期行為，吞掉以免主控台出現未處理錯誤
            transition.ready.catch(() => undefined);
            transition.finished.catch(() => undefined);
            transition.updateCallbackDone.catch(() => undefined);
            transition.skipTransition();
          }
        }
      })
    ),

    provideHttpClient(
      withInterceptors([apiCredentialsInterceptor, pageReadinessInterceptor]),
      withXsrfConfiguration({
        cookieName: 'XSRF-TOKEN-API',
        headerName: 'X-XSRF-TOKEN'
      })
    ),


  ]
};
