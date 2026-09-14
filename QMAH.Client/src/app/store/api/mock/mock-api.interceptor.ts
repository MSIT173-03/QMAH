import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpParams,
  HttpResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { environment } from "../index"
import * as handlers from './mock-handlers';

/** 單一假 API 路由：method 與路徑皆相符時，由 handle 產生回應內容 */
interface MockRoute {
  method: string;
  /** 相對於 environment.apiBaseUrl 的路徑；擷取群組依序傳入 handle 的 segments */
  path: RegExp;
  handle: (segments: string[], params: HttpParams, body: unknown) => unknown;
  /** 成功時的 HTTP 狀態碼，預設 200 */
  status?: number;
}

const ROUTES: MockRoute[] = [
  { method: 'GET', path: /^\/store\/categories$/, handle: () => handlers.listCategories() },
  { method: 'GET', path: /^\/store\/products$/, handle: (_, params) => handlers.listProducts(params) },
  { method: 'GET', path: /^\/store\/products\/([^/]+)$/, handle: ([id]) => handlers.getProduct(id) },
  { method: 'GET', path: /^\/store\/products\/([^/]+)\/related$/, handle: ([id], params) => handlers.listRelated(id, params) },
  { method: 'GET', path: /^\/store\/products\/([^/]+)\/reviews$/, handle: ([id], params) => handlers.listReviews(id, params) },
  { method: 'GET', path: /^\/store\/home\/hero-slides$/, handle: () => handlers.listHeroSlides() },
  { method: 'GET', path: /^\/store\/home\/flash-sale$/, handle: () => handlers.getFlashSale() },
  { method: 'GET', path: /^\/store\/brands$/, handle: () => handlers.listBrands() },
  { method: 'GET', path: /^\/store\/rankings$/, handle: (_, params) => handlers.listRankings(params) },
  { method: 'GET', path: /^\/store\/recommendations$/, handle: (_, params) => handlers.listRecommendations(params) },
  { method: 'GET', path: /^\/store\/coupons\/claimable$/, handle: () => handlers.listClaimableCoupons() },
  { method: 'GET', path: /^\/store\/search\/hot-links$/, handle: () => handlers.listHotLinks() },
  { method: 'GET', path: /^\/store\/search\/suggestions$/, handle: (_, params) => handlers.listSuggestions(params) },
  { method: 'GET', path: /^\/store\/cart$/, handle: () => handlers.getCart() },
  { method: 'POST', path: /^\/store\/cart\/items$/, handle: (_, __, body) => handlers.addCartItem(body) },
  { method: 'PATCH', path: /^\/store\/cart\/items\/([^/]+)$/, handle: ([id], __, body) => handlers.updateCartItem(id, body) },
  { method: 'DELETE', path: /^\/store\/cart\/items\/([^/]+)$/, handle: ([id]) => handlers.removeCartItem(id) },
  { method: 'GET', path: /^\/store\/member\/profile$/, handle: () => handlers.getMemberProfile() },
  { method: 'GET', path: /^\/store\/member\/coupons$/, handle: () => handlers.listMemberCoupons() },
  { method: 'GET', path: /^\/store\/checkout\/options$/, handle: () => handlers.getCheckoutOptions() },
  { method: 'POST', path: /^\/store\/orders$/, handle: (_, __, body) => handlers.createOrder(body), status: 201 },
  { method: 'GET', path: /^\/store\/site\/config$/, handle: () => handlers.getSiteConfig() },
];

/**
 * 假 API 攔截器：攔下所有送往 environment.apiBaseUrl 的請求，不實際發送，
 * 改由 mock-handlers 依請求參數產生測試資料。後端 API 完成後，自 app.config 移除即改打真實 API。
 *
 * 修改為只攔截送往 baseUrl/store 的請求
 */
export const mockApiInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(environment.apiBaseUrl + "/store")) return next(request);

  const path = request.url.slice(environment.apiBaseUrl.length);
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
  return throwError(() => new HttpErrorResponse({ status: 404, statusText: 'Not Found', url: request.url }));
};

/** 以假 API 提供 HttpClient，供單元測試使用 */
export function provideMockApi() {
  return provideHttpClient(withInterceptors([mockApiInterceptor]));
}
