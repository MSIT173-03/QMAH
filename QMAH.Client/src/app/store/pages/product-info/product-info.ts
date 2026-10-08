import { Component, computed, effect, inject, input, linkedSignal, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, map, of, startWith, switchMap } from 'rxjs';

import {
  SessionBar,
  SiteHeader,
  SearchBar,
  Breadcrumb,
  BreadcrumbItem,
  EmptyState,
} from '../../component';
import { CatalogApi, ReviewApi } from '../../api';
import { Product, Review } from '../../api/api.models';
import { ReviewDraft } from '../../api/review.api';
import { toReviewPage } from '../../api/catalog.api-dto';
import { CART_PATH, HOME_PATH, PRODUCT_LIST_PATH, categoryPath, searchPath } from '../../shared/paths';
import { injectCartState } from '../../shared/page-state';
import { PurchasedProducts } from '../../shared/purchased-products';
import { toProductView, wasPrice } from '../../shared/product-view';
import { ProductGallery } from './product-gallery/product-gallery';
import { ProductSummary } from './product-summary/product-summary';
import { ProductDetail } from './product-detail/product-detail';
import { ProductReviews } from './product-reviews/product-reviews';
import { RelatedProducts } from './related-products/related-products';
import { ScrollTop } from '../../component/scroll-top/scroll-top';
import { RELATED_LIMIT, REVIEW_FILTERS } from './product-info.data';

/**
 * 商品詳情頁面。
 * 統整頁首、麵包屑、商品圖庫、商品資訊欄、商品說明、評價與同類推薦；
 * 商品 ID 由路由參數帶入，商品、評價（依篩選條件）與同類推薦皆隨 ID 變動重新取得，
 * 加入購物車與直接購買皆在此呼叫 API 並以回應內容更新購物車狀態。
 */
@Component({
  selector: 'app-product-info',
  host: { class: 'store-app' },
  imports: [ScrollTop, 
    SessionBar,
    SiteHeader,
    SearchBar,
    Breadcrumb,
    EmptyState,
    ProductGallery,
    ProductSummary,
    ProductDetail,
    ProductReviews,
    RelatedProducts,
  ],
  templateUrl: './product-info.html',
  styleUrl: './product-info.scss',
})
export class ProductInfo {
  private readonly router = inject(Router);
  private readonly catalogApi = inject(CatalogApi);
  private readonly reviewApi = inject(ReviewApi);
  private readonly purchased = inject(PurchasedProducts);

  /* ===============================
     網址路徑參數（由 router 的 component input binding 帶入）
     =============================== */

  /** 商品 ID */
  id = input('');

  constructor() {
    this.purchased.ensureLoaded();
    // 進入商品頁時捲回頂端；從同類推薦切換商品時元件會被重用，因此以 id 變動觸發而非只在建立時執行。
    effect(() => {
      this.id();
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    });
  }

  /* ===============================
     頁面狀態
     =============================== */

  /** 購物車狀態（件數顯示於頁首） */
  protected readonly cart = injectCartState();
  /** 頁首搜尋框目前輸入值 */
  protected searchQuery = signal('');
  /** 目前選取的評價篩選條件索引（對應 REVIEW_FILTERS） */
  protected reviewFilter = signal(0);

  /* ===============================
     固定版面文字與外部資料
     =============================== */

  /** 商品列表頁路徑，供「查無此商品」時的返回按鈕使用 */
  protected readonly productsPath = PRODUCT_LIST_PATH;

  /* ===============================
     目前商品與相關資料
     =============================== */

  /** 目前商品；undefined 代表載入中，null 代表查無此商品 */
  protected item = toSignal(
    toObservable(this.id).pipe(
      switchMap((id) => this.catalogApi.getProduct(id).pipe(catchError(() => of(null)))),
    ),
  );

  /** 折扣前原價，無折扣時為 null（不顯示劃線價，亦代表無折扣） */
  protected was = computed(() => {
    const item = this.item();
    return item ? wasPrice(item) : null;
  });
  /** 同類推薦清單：同器類的熱銷商品（排除目前商品），商品載入後才查詢 */
  protected related = toSignal(
    toObservable(this.item).pipe(
      switchMap((item) =>
        item
          ? this.catalogApi.getRelated(item, RELATED_LIMIT).pipe(catchError(() => of<Product[]>([])))
          : of<Product[]>([]),
      ),
      map((items) => items.map(toProductView)),
    ),
    { initialValue: [] },
  );

  /** 向後端取得的目前商品全部評價；切換篩選條件不重新請求，null 代表載入失敗 */
  private readonly loadedReviews = toSignal(
    toObservable(this.id).pipe(
      switchMap((id) => this.catalogApi.getReviews(id).pipe(catchError(() => of(null)), startWith(undefined))),
    ),
  );
  /** 目前商品的全部評價；會員儲存評價後直接更新這份清單，不需要重新請求 */
  private readonly allReviews = linkedSignal<Review[] | null | undefined>(() => this.loadedReviews());
  /** 儲存評價後依最新清單重算的評分與評論數；在這之前沿用商品 API 的值 */
  private readonly savedStats = signal<{ id: string; rating: number; count: number } | null>(null);
  /** 目前顯示的商品評分 */
  protected readonly rating = computed(() => {
    const item = this.item();
    const saved = this.savedStats();
    return saved && saved.id === item?.id ? saved.rating : (item?.rating ?? 0);
  });
  /** 目前顯示的商品評論數 */
  protected readonly reviewCount = computed(() => {
    const item = this.item();
    const saved = this.savedStats();
    return saved && saved.id === item?.id ? saved.count : (item?.reviewCount ?? 0);
  });
  /** 評價清單顯示的評價：不含目前會員自己的評價（自己的只顯示在評價區上方的編輯區） */
  private readonly listedReviews = computed(() => {
    const all = this.allReviews();
    const mine = this.myReview();
    return all && mine ? all.filter((review) => review.id !== mine.id) : all;
  });
  /** 目前商品在選取的篩選條件下的評價（篩選與統計在前端計算） */
  private readonly reviewPage = computed(() => {
    const listed = this.listedReviews();
    return listed ? toReviewPage(listed, REVIEW_FILTERS[this.reviewFilter()].query) : null;
  });
  /** 符合目前篩選條件的評價 */
  protected reviews = computed(() => this.reviewPage()?.items ?? []);
  /** 各篩選條件的則數（依 REVIEW_FILTERS 順序） */
  protected reviewCounts = computed(() => {
    const page = this.reviewPage();
    return page ? REVIEW_FILTERS.map((filter) => filter.count(page)) : [];
  });

  /* ===============================
     自己的評價（買過才能評價：訂單不是待付款或已取消）
     =============================== */

  /** 目前會員是否買過這件商品 */
  protected readonly canReview = computed(() => this.purchased.has(this.id()));
  /** 讀取或送出評價失敗的說明；切換商品後清除。 */
  protected readonly reviewError = signal<string | null>(null);
  /** 向後端取得的自己的評價；undefined 代表尚在載入（或不能評價），null 代表還沒有評價 */
  private readonly loadedMyReview = toSignal(
    toObservable(computed(() => (this.canReview() ? this.id() : null))).pipe(
      switchMap((id) => {
        this.reviewError.set(null);
        return id ? this.reviewApi.getMyReview(id).pipe(
          catchError(() => {
            this.reviewError.set('無法讀取你的評價，請稍後重新整理。');
            return of(undefined);
          }),
          startWith(undefined),
        ) : of(undefined);
      }),
    ),
  );
  /** 自己的評價；送出後直接換成後端回傳的內容 */
  protected readonly myReview = linkedSignal<Review | null | undefined>(() => this.loadedMyReview());
  /** 評價正在送出 */
  protected readonly reviewSaving = signal(false);

  /** 麵包屑導覽項目：首頁 / 器類 / 商品名稱 */
  protected breadcrumbItems = computed<BreadcrumbItem[]>(() => {
    const item = this.item();
    if (!item) return [{ label: '首頁', href: HOME_PATH }];
    return [
      { label: '首頁', href: HOME_PATH },
      { label: item.category, href: categoryPath(item.category) },
      { label: item.name },
    ];
  });

  /* ===============================
     使用者操作
     =============================== */

  /** 加入購物車：依選購數量加入目前商品 */
  protected onAddToCart(qty: number): void {
    const item = this.item();
    if (item) this.cart.add(item.id, qty);
  }

  /** 加入並查看購物車：加入成功後前往購物車頁，由購物車頁再進入結帳 */
  protected onBuyNow(qty: number): void {
    const item = this.item();
    if (!item) return;
    this.cart.add(item.id, qty, () => this.router.navigate([CART_PATH]));
  }

  /** 送出評價（新增或編輯）：成功後顯示為不可修改的文字，並同步更新評價清單與評分 */
  protected onSaveReview(draft: ReviewDraft): void {
    if (this.reviewSaving()) return;
    const id = this.id();
    this.reviewSaving.set(true);
    this.reviewError.set(null);
    this.reviewApi.saveMyReview(id, draft).subscribe({
      next: (saved) => {
        this.reviewSaving.set(false);
        if (this.id() !== id) return; // 儲存期間已換到別的商品
        this.myReview.set(saved);
        this.applySavedReview(id, saved);
      },
      error: (error: unknown) => {
        this.reviewSaving.set(false);
        if (this.id() !== id) return;
        if (error instanceof HttpErrorResponse && error.status === 401) {
          // 登入已失效：清除登入狀態並詢問是否重新登入。
          this.cart.handleUnauthorized();
          return;
        }
        const detail = error instanceof HttpErrorResponse ? error.error?.detail : null;
        this.reviewError.set(typeof detail === 'string' && detail ? detail : '評價送出失敗，請稍後再試。');
      },
    });
  }

  /** 把儲存後的評價放進評價清單（已有則取代、沒有則加在最前面），並依新清單重算評分與評論數 */
  private applySavedReview(id: string, saved: Review): void {
    const all = this.allReviews();
    if (!all) return;
    const next = all.some((review) => review.id === saved.id)
      ? all.map((review) => (review.id === saved.id ? saved : review))
      : [saved, ...all];
    this.allReviews.set(next);
    const average = next.reduce((sum, review) => sum + review.stars, 0) / next.length;
    this.savedStats.set({ id, rating: Math.round(average * 10) / 10, count: next.length });
  }

  /** 從同類推薦加入購物車：數量 1 */
  protected onAddRelated(productId: string): void {
    this.cart.add(productId);
  }

  /** 送出頁首搜尋：前往商品列表頁，並帶上關鍵字查詢字串 */
  protected onSearch(keyword: string): void {
    this.router.navigateByUrl(searchPath(keyword));
  }
}
