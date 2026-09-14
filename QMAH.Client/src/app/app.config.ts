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

import { mockApiInterceptor } from "./store/api/mock/mock-api.interceptor"

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
      // mockApiInterceptor 以假資料回應所有 API 請求；後端完成後移除即改打真實 API
      withInterceptors([apiCredentialsInterceptor, mockApiInterceptor]),
      withInterceptors([apiCredentialsInterceptor]),
      withXsrfConfiguration({
        cookieName: 'XSRF-TOKEN-API',
        headerName: 'X-XSRF-TOKEN'
      })
    )
  ]
};
