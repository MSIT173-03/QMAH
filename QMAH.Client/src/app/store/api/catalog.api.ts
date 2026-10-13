import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, catchError, concat, finalize, forkJoin, map, of, shareReplay, switchMap, tap } from 'rxjs';
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
  ApiProductListItem,
  ApiProductPage,
  ApiProductReviewsResponse,
  ApiCategory,
  toCategory,
  toCategoryCode,
  toProduct,
  toProductDetail,
  toReview,
} from './catalog.api-dto';

/** 後端單次查詢最多回傳的評論筆數（ApiPaging 的 pageSize 上限），用於以最少請求取回全部評論 */
const REVIEWS_MAX_PAGE_SIZE = 100;

/** 快取視為「新鮮」的時間：期間內直接用快取、不再發請求 */
const FRESH_MS = 20_000;
/** 快取最久可先拿來顯示的時間：超過新鮮期但在此之內時，先秒顯示快取，同時背景更新 */
const STALE_MS = 30 * 60_000;
/** 快取筆數上限，超過時丟掉最舊的 */
const CACHE_MAX = 200;

/** 商品型錄與詳情 API */
@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private readonly http = inject(HttpClient);
  /** 公開型錄資料的記憶體快取（只放與會員無關的資料；換頁、切分類時先秒顯示快取，再背景更新） */
  private readonly cache = new Map<string, { at: number; value: unknown }>();
  private readonly inFlight = new Map<string, Observable<unknown>>();

  /**
   * stale-while-revalidate：新鮮快取直接回傳；過期但仍可用的快取先回傳再背景更新（會依序送出兩次值）；沒有快取才等網路。
   * 失敗的請求不寫入快取；已有快取時背景更新失敗就靜默沿用快取。
   */
  private swr<T>(key: string, load: () => Observable<T>, bypass = false): Observable<T> {
    const hit = bypass ? undefined : this.cache.get(key);
    const age = hit ? Date.now() - hit.at : Infinity;
    if (hit && age < FRESH_MS) return of(structuredClone(hit.value as T));
    const running = this.inFlight.get(key) as Observable<T> | undefined;
    const fetch$ = running ?? load().pipe(
      tap((value) => {
        if (this.cache.size >= CACHE_MAX) this.cache.delete(this.cache.keys().next().value!);
        this.cache.set(key, { at: Date.now(), value: structuredClone(value) });
      }),
      finalize(() => { if (this.inFlight.get(key) === fetch$) this.inFlight.delete(key); }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    if (!running) this.inFlight.set(key, fetch$);
    if (hit && age < STALE_MS) return concat(of(structuredClone(hit.value as T)), fetch$.pipe(catchError(() => EMPTY)));
    return fetch$;
  }

  /** 預先把某個商品查詢放進快取（不影響畫面）；使用者之後切到同樣條件就是秒開 */
  prefetchProducts(query: ProductQuery): void {
    this.getProducts(query).subscribe({ error: () => undefined });
  }

  /** GET /store/categories：器類清單 */
  getCategories(): Observable<Category[]> {
    return this.swr('categories', () => this.http.get<ApiCategory[]>(apiUrl('/categories')).pipe(map((res) => res.map(toCategory)))).pipe(
      // 分類導覽是輔助資料；資料庫短暫失敗時保留商品頁與其他 Area，不讓 toSignal 拋出錯誤。
      catchError(() => of([])),
    );
  }

  /** GET /store/eras：年代清單（依年代先後排序），失敗時與器類清單一樣降級為空清單 */
  getEras(): Observable<Era[]> {
    return this.swr('eras', () => this.http.get<Era[]>(apiUrl('/eras'))).pipe(catchError(() => of([])));
  }

  /** GET /store/promotions：商城與社群共用的官方優惠活動公告，顯示於頂部公告列。 */
  getPromotions(): Observable<StorePromotion[]> {
    // 優惠活動只是商城輔助內容；公告暫時不可用時仍保留商品瀏覽與結帳入口。
    return this.swr('promotions', () => this.http.get<StorePromotion[]>(apiUrl('/promotions'))).pipe(catchError(() => of([])));
  }

  /**
   * GET /store/products：商品清單。後端支援關鍵字、器類代碼、限折扣品、排序、價格區間與分頁。
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
    // 「重新載入」（reload 計數大於 0）一律略過快取
    const bypass = Number((query as { reload?: number }).reload) > 0;
    return this.swr(
      `products?${params.toString()}`,
      () =>
        this.http.get<ApiProductPage>(apiUrl('/products'), { params }).pipe(
          map((res) => ({
            items: res.items.map(toProduct),
            total: res.totalCount,
            // 後端會把超出範圍的頁碼夾回最後一頁，呼叫端應以此值為準。
            page: res.page,
            pageSize: res.pageSize,
          })),
        ),
      bypass,
    );
  }

  /** GET /store/products/{id}：商品詳情，查無商品時回應 404 */
  getProduct(id: string): Observable<ProductDetail> {
    return this.swr(`product/${id}`, () => this.http.get<ApiProductDetail>(apiUrl`/products/${id}`).pipe(map(toProductDetail)));
  }

  /** 滑鼠移到商品卡片上時先把詳情放進快取，點進去就是秒開 */
  prefetchProduct(id: string): void {
    if (id) this.getProduct(id).subscribe({ error: () => undefined });
  }

  /**
   * GET /store/products/{id}/related：同類推薦。後端找出買過這件商品的所有帳號，
   * 依這些帳號買過的商品合計購買數量由多到少排序，取前 limit + 1 項；其中有這件商品就排除它，否則排除最後一項。
   * 還沒有人買過這件商品（後端回傳空陣列）時，退回同器類的熱銷商品（依販售數量由多到少，排除目前商品）；
   * 後端沒有專用的 route，直接沿用商品清單 API，多取一筆以補足排除自身後的數量。失敗時保留錯誤，由呼叫端決定如何降級。
   */
  getRelated(product: Pick<Product, 'id' | 'category'>, limit: number): Observable<Product[]> {
    return this.http
      .get<ApiProductListItem[]>(apiUrl`/products/${product.id}/related`, { params: toParams({ limit }) })
      .pipe(
        map((items) => items.map(toProduct)),
        switchMap((items) =>
          items.length > 0
            ? of(items)
            : this.getProducts({ cat: product.category, order: 1, pageSize: limit + 1 }).pipe(
                map((page) => page.items.filter((item) => item.id !== product.id).slice(0, limit)),
              ),
        ),
      );
  }

  /**
   * GET /store/products/recommended：為你推薦。後端依目前會員買過的商品在各器類的數量比例，
   * 隨機挑出對應器類的商品；未登入或沒有購買紀錄時回傳隨機商品。每次查詢結果不同。
   */
  getRecommended(limit: number): Observable<Product[]> {
    return this.http
      .get<ApiProductListItem[]>(apiUrl('/products/recommended'), { params: toParams({ limit }) })
      .pipe(map((items) => items.map(toProduct)));
  }

  /**
   * GET /store/products/{id}/reviews：取回商品的全部評論。後端只支援分頁，不支援依星等篩選也不提供各星等則數，
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
