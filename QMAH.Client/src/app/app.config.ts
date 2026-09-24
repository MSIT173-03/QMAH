import {
  HttpInterceptorFn,
  provideHttpClient,
  withInterceptors,
  withXsrfConfiguration
} from '@angular/common/http';

import {
  ApplicationConfig,
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

function gameMode(route: ActivatedRouteSnapshot): 'multiplayer' | 'training' | 'guide' | null {
  const path = `/${route.pathFromRoot.flatMap(snapshot => snapshot.url.map(segment => segment.path)).filter(Boolean).join('/')}`;
  if (path === '/game' || path === '/game/rooms' || path === '/game/demo' || path.startsWith('/game/room/')) return 'multiplayer';
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
    provideBrowserGlobalErrorListeners(),

    provideRouter(
      routes,
      withComponentInputBinding(),
      withViewTransitions({
        skipInitialTransition: true,
        onViewTransitionCreated: ({ from, to, transition }) => {
          const previousMode = gameMode(from);
          if (!previousMode || previousMode !== gameMode(to)) transition.skipTransition();
        }
      })
    ),

    provideHttpClient(
      withInterceptors([apiCredentialsInterceptor]),
      withXsrfConfiguration({
        cookieName: 'XSRF-TOKEN-API',
        headerName: 'X-XSRF-TOKEN'
      })
    ),


  ]
};
