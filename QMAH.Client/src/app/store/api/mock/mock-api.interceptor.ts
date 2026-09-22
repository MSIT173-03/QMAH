import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpParams,
  HttpResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { STORE_API_BASE } from '../http';
import * as handlers from './mock-handlers';

/** 單一假 API 路由：method 與路徑皆相符時，由 handle 產生回應內容 */
interface MockRoute {
  method: string;
  /** 相對於 STORE_API_BASE 的路徑；擷取群組依序傳入 handle 的 segments */
  path: RegExp;
  handle: (segments: string[], params: HttpParams, body: unknown) => unknown;
  /** 成功時的 HTTP 狀態碼，預設 200 */
  status?: number;
}

const ROUTES: MockRoute[] = [
  // { method: 'GET', path: /^\/products$/, handle: (_, params) => handlers.listProducts(params) },
  // { method: 'GET', path: /^\/products\/([^/]+)$/, handle: ([id]) => handlers.getProduct(id) },
  // { method: 'GET', path: /^\/products\/([^/]+)\/reviews$/, handle: ([id], params) => handlers.listReviews(id, params) },
  { method: 'GET', path: /^\/home\/hero-slides$/, handle: () => handlers.listHeroSlides() },
  { method: 'GET', path: /^\/home\/flash-sale$/, handle: () => handlers.getFlashSale() },
  { method: 'GET', path: /^\/coupons\/claimable$/, handle: () => handlers.listClaimableCoupons() },
  { method: 'GET', path: /^\/search\/hot-links$/, handle: () => handlers.listHotLinks() },
  { method: 'GET', path: /^\/search\/suggestions$/, handle: (_, params) => handlers.listSuggestions(params) },
  { method: 'GET', path: /^\/cart$/, handle: () => handlers.getCart() },
  { method: 'POST', path: /^\/cart\/items$/, handle: (_, __, body) => handlers.addCartItem(body) },
  { method: 'PATCH', path: /^\/cart\/items\/([^/]+)$/, handle: ([id], __, body) => handlers.updateCartItem(id, body) },
  { method: 'DELETE', path: /^\/cart\/items\/([^/]+)$/, handle: ([id]) => handlers.removeCartItem(id) },
  { method: 'GET', path: /^\/member\/profile$/, handle: () => handlers.getMemberProfile() },
  { method: 'GET', path: /^\/member\/coupons$/, handle: () => handlers.listMemberCoupons() },
  { method: 'GET', path: /^\/checkout\/options$/, handle: () => handlers.getCheckoutOptions() },
  { method: 'POST', path: /^\/checkout\/quote$/, handle: (_, __, body) => handlers.getOrderQuote(body) },
  // { method: 'POST', path: /^\/orders$/, handle: (_, __, body) => handlers.createOrder(body), status: 201 },
  { method: 'GET', path: /^\/site\/config$/, handle: () => handlers.getSiteConfig() },
];

/**
 * 假 API 攔截器：攔下送往 STORE_API_BASE（environment.apiBaseUrl + /store）且能比對到 ROUTES 規則的請求，
 * 改由 mock-handlers 依請求參數產生測試資料；比對不到規則的請求則放行給真實後端。後端 API 全部完成後，
 * 自 app.config 移除即改打真實 API。
 */
export const mockApiInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(STORE_API_BASE)) return next(request);

  const path = request.url.slice(STORE_API_BASE.length);
  for (const route of ROUTES) {
    const match = route.method === request.method ? route.path.exec(path) : null;
    if (!match) continue;
    try {
      const body = route.handle(match.slice(1).map(decodeURIComponent), request.params, request.body);
      // 以深拷貝模擬經過網路序列化的回應，避免呼叫端修改到假資料庫本身
      return of(new HttpResponse({ status: route.status ?? 200, url: request.url, body: structuredClone(body) }));
    } catch (error) {
      if (!(error instanceof handlers.MockApiError)) throw error;
      return throwError(
        () =>
          new HttpErrorResponse({
            status: error.status,
            statusText: error.message,
            url: request.url,
            error: { message: error.message },
          }),
      );
    }
  }
  return next(request);
};

/**
 * 以假 API 提供 HttpClient，供單元測試使用。
 * 假 API 沒有涵蓋的請求（已改由真實後端提供的端點）不會送出網路請求，而是交給測試用的 HttpClient 後端擱置，
 * 避免測試環境因連不到後端而出現 status 0 錯誤。
 */
export function provideMockApi() {
  return [provideHttpClient(withInterceptors([mockApiInterceptor])), provideHttpClientTesting()];
}
