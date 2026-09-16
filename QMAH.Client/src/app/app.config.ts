import {
  HttpInterceptorFn,
  provideHttpClient,
  withInterceptors,
  withXsrfConfiguration
} from '@angular/common/http';
import { ApplicationConfig, ApplicationRef, provideBrowserGlobalErrorListeners, inject } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { finalize } from 'rxjs';

import { routes } from './app.routes';
import { environment } from '../environments/environment';

// API 使用 Identity cookie 維持登入狀態；集中設定 credentials，避免各服務自行重複處理。
const apiCredentialsInterceptor: HttpInterceptorFn = (request, next) => {
  const isApiRequest = request.url.startsWith(environment.apiBaseUrl);

  return next(isApiRequest
    ? request.clone({ withCredentials: true })
    : request);
};

// 診斷發現：這個專案裡 HTTP 回應的訂閱回呼不會自動觸發 Angular 的變更偵測，畫面會卡在舊狀態
// 直到使用者點擊任何東西為止。這裡用 ApplicationRef.tick() 在每個 API 回應（成功或失敗）結束後
// 強制刷新一次畫面，一次修好全站，不必每個元件各自處理——所以元件內部不要再另外用
// ngZone.run() 包狀態更新，兩套觸發機制疊在一起，反而會讓 Angular 在同一輪檢查裡看到值被改兩次，
// 丟出 NG0100（ExpressionChangedAfterItHasBeenCheckedError）。刷新畫面只交給這裡統一處理。
//
// tick() 不允許重入（同一時間只能有一次 tick 在跑）。如果頁面上同時有多個請求幾乎同時完成
// （例如 NavBar 的通知鈴鐺每 20 秒輪詢一次，剛好跟頁面本身的請求撞在一起），用一個共用旗標
// 把同時發生的多次請求合併成「之後只補一次 tick」，避免重入；真的失敗也印出來，不默默吞掉。
let tickScheduled = false;
const forceRefreshAfterApiCallInterceptor: HttpInterceptorFn = (request, next) => {
  const appRef = inject(ApplicationRef);
  return next(request).pipe(
    finalize(() => {
      if (tickScheduled) return;
      tickScheduled = true;
      setTimeout(() => {
        tickScheduled = false;
        try {
          appRef.tick();
        } catch (err) {
          console.error('[forceRefreshAfterApiCallInterceptor] appRef.tick() 失敗:', err);
        }
      }, 0);
    })
  );
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(
      withInterceptors([apiCredentialsInterceptor, forceRefreshAfterApiCallInterceptor]),
      withXsrfConfiguration({
        cookieName: 'XSRF-TOKEN-API',
        headerName: 'X-XSRF-TOKEN'
      })
    )
  ]
};
