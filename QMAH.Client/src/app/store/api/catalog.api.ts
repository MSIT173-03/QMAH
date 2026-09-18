import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { apiUrl, getField, toParams } from './http';
import {
  Category,
  Page,
  Product,
  ProductDetail,
  ProductQuery,
  ReviewPage,
  ReviewQuery,
} from './api.models';
import {
  ApiProductDetail,
  ApiProductPage,
  ApiProductReviewsResponse,
  toCategoryCode,
  toProduct,
  toProductDetail,
  toReviewPage,
} from './catalog.api-dto';


/** 後端單次查詢最多回傳的評論筆數（見 doc/apis.xml pageSize 參數），用於一次取回全部評論 */
const REVIEWS_MAX_PAGE_SIZE = 100;


/** 商品型錄與詳情 API */
@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private readonly http = inject(HttpClient);

  /** GET /categories：器類清單 */
  getCategories(): Observable<Category[]> {
    return getField(this.http, apiUrl('/categories'), 'categories');
  }

  /**
   * GET /products：商品清單。後端支援關鍵字、器類、排序、價格區間與分頁；
   * 器類以 category 參數送出（對應後端 CategoryType enum 的數字代碼，見 catalog.api-dto 的 toCategoryCode）。
   * 限折扣品等前端篩選條件後端尚未提供，暫不送出。
   */
  getProducts(query: ProductQuery = {}): Observable<Page<Product>> {
    const params = toParams({
      q: query.q,
      category: query.cat ? toCategoryCode(query.cat) : undefined,
      order: query.order,
      minPrice: query.priceMin,
      maxPrice: query.priceMax,
      page: query.page,
      pageSize: query.pageSize,
    });
    return this.http.get<ApiProductPage>(apiUrl('/products'), { params }).pipe(
      map((res) => ({
        items: res.items.map(toProduct),
        total: res.totalCount,
        page: res.page,
        pageSize: res.pageSize,
      })),
    );
  }

  /** GET /products/{id}：商品詳情，查無商品時回應 404 */
  getProduct(id: string): Observable<ProductDetail> {
    return this.http.get<ApiProductDetail>(apiUrl`/products/${id}`).pipe(map(toProductDetail));
  }

  /** GET /products/{id}/related：同類推薦（同器類優先，不足以其他器類補齊） */
  getRelated(id: string, limit?: number): Observable<Product[]> {
    return getField(this.http, apiUrl`/products/${id}/related`, 'items', { limit });
  }

  /**
   * GET /products/{id}/reviews：商品評價。後端只支援分頁，不支援依星等／照片篩選，也不提供各星等
   * 則數與附照片則數（見 doc/apis.xml），故一次取回全部評論（上限 100 則），篩選、分頁與統計改在前端計算；
   * 評論數超過 100 則的商品，篩選與統計僅涵蓋前 100 則。
   */
  getReviews(id: string, query: ReviewQuery = {}): Observable<ReviewPage> {
    const params = toParams({ page: 1, pageSize: REVIEWS_MAX_PAGE_SIZE });
    return this.http
      .get<ApiProductReviewsResponse>(apiUrl`/products/${id}/reviews`, { params })
      .pipe(map((res) => toReviewPage(res, query)));
  }
}
