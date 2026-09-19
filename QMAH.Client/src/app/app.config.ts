import {
  HttpInterceptorFn,
  provideHttpClient,
  withInterceptors,
  withXsrfConfiguration
} from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { environment } from '../environments/environment';

// API 使用 Identity cookie 維持登入狀態；集中設定 credentials，避免各服務自行重複處理。
const apiCredentialsInterceptor: HttpInterceptorFn = (request, next) => {
  const isApiRequest = request.url.startsWith(environment.apiBaseUrl);

  return next(isApiRequest
    ? request.clone({ withCredentials: true })
    : request);
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(
      // integration: Store mockApiInterceptor 僅供單元測試的 provideMockApi() 使用；正式 App 必須呼叫已整合的真實 API。
      // 若把 mock interceptor 放在這裡，商城頁面會在部署時被假資料攔截，導致後端訂單與庫存流程失效。
      withInterceptors([apiCredentialsInterceptor]),
      withXsrfConfiguration({
        cookieName: 'XSRF-TOKEN-API',
        headerName: 'X-XSRF-TOKEN'
      })
    )
  ]
};
