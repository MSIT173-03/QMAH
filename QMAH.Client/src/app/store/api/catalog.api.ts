import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { apiUrl, toParams } from './http';
import {
  Category,
  Era,
  Page,
  Product,
  ProductDetail,
  ProductQuery,
  Review,
  StorePromotion,
} from './api.models';
import {
  ApiProductDetail,
  ApiProductPage,
  ApiProductReviewsResponse,
  ApiCategory,
  ApiStorePromotion,
  toCategory,
  toCategoryCode,
  toProduct,
  toProductDetail,
  toReview,
  toStorePromotion,
} from './catalog.api-dto';


/** 後端單次查詢最多回傳的評論筆數（ApiPaging 的 pageSize 上限），用於以最少請求取回全部評論 */
const REVIEWS_MAX_PAGE_SIZE = 100;


/** 商品型錄與詳情 API */
@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private readonly http = inject(HttpClient);

  /** GET /categories：器類清單 */
  getCategories(): Observable<Category[]> {
    return this.http.get<ApiCategory[]>(apiUrl('/categories')).pipe(
      map((res) => res.map(toCategory)),
      // 分類導覽是輔助資料；資料庫短暫失敗時保留商品頁與其他 Area，不讓 toSignal 拋出錯誤。
      catchError(() => of([])),
    );
  }

  /** GET /eras：年代清單（依年代先後排序），失敗時與器類清單一樣降級為空清單 */
  getEras(): Observable<Era[]> {
    return this.http.get<Era[]>(apiUrl('/eras')).pipe(catchError(() => of([])));
  }

  /** GET /promotions：商城與社群共用的官方優惠活動公告，顯示於頂部公告列。 */
  getPromotions(): Observable<StorePromotion[]> {
    return this.http.get<ApiStorePromotion[]>(apiUrl('/promotions')).pipe(
      map((res) => res.map(toStorePromotion)),
      // 優惠活動只是商城輔助內容；公告暫時不可用時仍保留商品瀏覽與結帳入口。
      catchError(() => of([])),
    );
  }

  /**
   * GET /products：商品清單。後端支援關鍵字、器類代碼、限折扣品、排序、價格區間與分頁。
   * 失敗時保留錯誤，由呼叫端決定要顯示錯誤狀態（商品列表頁）或靜默降級（首頁輔助區塊），
   * 避免把伺服器錯誤誤顯示成「找不到符合條件的商品」。
   */
  getProducts(query: ProductQuery = {}): Observable<Page<Product>> {
    const params = toParams({
      q: query.q,
      categoryCode: query.cat ? toCategoryCode(query.cat) : undefined,
      eraCode: query.era,
      order: query.order,
      minPrice: query.priceMin,
      maxPrice: query.priceMax,
      dealOnly: query.dealOnly,
      page: query.page,
      pageSize: query.pageSize,
    });
    return this.http.get<ApiProductPage>(apiUrl('/products'), { params }).pipe(
      map((res) => ({
        items: res.items.map(toProduct),
        total: res.totalCount,
        // 後端會把超出範圍的頁碼夾回最後一頁，呼叫端應以此值為準。
        page: res.page,
        pageSize: res.pageSize,
      })),
    );
  }

  /** GET /products/{id}：商品詳情，查無商品時回應 404 */
  getProduct(id: string): Observable<ProductDetail> {
    return this.http.get<ApiProductDetail>(apiUrl`/products/${id}`).pipe(map(toProductDetail));
  }

  /**
   * 同類推薦：同器類的熱銷商品（依販售數量由多到少），排除目前商品。
   * 後端沒有專用的 related route，直接沿用商品清單 API，多取一筆以補足排除自身後的數量。
   */
  getRelated(product: Pick<Product, 'id' | 'category'>, limit: number): Observable<Product[]> {
    return this.getProducts({ cat: product.category, order: 1, pageSize: limit + 1 }).pipe(
      map((page) => page.items.filter((item) => item.id !== product.id).slice(0, limit)),
    );
  }

  /**
   * GET /products/{id}/reviews：取回商品的全部評論。後端只支援分頁，不支援依星等篩選也不提供各星等則數，
   * 因此逐頁取回全部評論，篩選與統計交由 toReviewPage 在前端計算。
   */
  getReviews(id: string): Observable<Review[]> {
    const fetchPage = (page: number) =>
      this.http.get<ApiProductReviewsResponse>(apiUrl`/products/${id}/reviews`, {
        params: toParams({ page, pageSize: REVIEWS_MAX_PAGE_SIZE }),
      });
    return fetchPage(1).pipe(
      switchMap((first) => {
        const rest = Array.from({ length: Math.max(0, first.reviews.totalPages - 1) }, (_, i) => fetchPage(i + 2));
        return rest.length ? forkJoin(rest).pipe(map((pages) => [first, ...pages])) : of([first]);
      }),
      map((pages) => pages.flatMap((page) => page.reviews.items.map(toReview))),
    );
  }
}
