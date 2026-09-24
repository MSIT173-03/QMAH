import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';

import {
  SessionBar,
  SiteHeader,
  SearchBar,
  Breadcrumb,
  BreadcrumbItem,
  EmptyState,
} from '../../component';
import { CatalogApi, SiteApi } from '../../api';
import { Product } from '../../api/api.models';
import { toReviewPage } from '../../api/catalog.api-dto';
import { CART_PATH, HOME_PATH, PRODUCT_LIST_PATH, categoryPath, searchPath } from '../../shared/paths';
import { injectCartState } from '../../shared/page-state';
import { toProductView, wasPrice } from '../../shared/product-view';
import { ProductGallery } from './product-gallery/product-gallery';
import { ProductSummary } from './product-summary/product-summary';
import { ProductDetail } from './product-detail/product-detail';
import { ProductReviews } from './product-reviews/product-reviews';
import { RelatedProducts } from './related-products/related-products';
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
  imports: [
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

  /* ===============================
     網址路徑參數（由 router 的 component input binding 帶入）
     =============================== */

  /** 商品 ID */
  id = input('');

  constructor() {
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

  /** 全站設定 */
  private readonly config = toSignal(inject(SiteApi).getConfig());
  /** 尺寸量測說明與商品政策條列（全站共通文案） */
  protected sizeNote = computed(() => this.config()?.sizeNote ?? '');
  protected policies = computed(() => this.config()?.productPolicies ?? []);

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

  /** 目前商品的全部評價；切換篩選條件不重新請求，null 代表載入失敗 */
  private readonly allReviews = toSignal(
    toObservable(this.id).pipe(
      switchMap((id) => this.catalogApi.getReviews(id).pipe(catchError(() => of(null)))),
    ),
  );
  /** 目前商品在選取的篩選條件下的評價（篩選與統計在前端計算） */
  private readonly reviewPage = computed(() => {
    const all = this.allReviews();
    return all ? toReviewPage(all, REVIEW_FILTERS[this.reviewFilter()].query) : null;
  });
  /** 符合目前篩選條件的評價 */
  protected reviews = computed(() => this.reviewPage()?.items ?? []);
  /** 各篩選條件的則數（依 REVIEW_FILTERS 順序） */
  protected reviewCounts = computed(() => {
    const page = this.reviewPage();
    return page ? REVIEW_FILTERS.map((filter) => filter.count(page)) : [];
  });

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

  /** 直接購買：目前正式付款選項尚未接通，先加入購物車並回到可查看狀態的購物車頁。 */
  protected onBuyNow(qty: number): void {
    const item = this.item();
    if (!item) return;
    // ui-integration: 不把「直接購買」送進尚未啟用的結帳頁；保留既有操作入口，但讓使用者回到真實可確認內容的購物車。
    this.cart.add(item.id, qty, () => this.router.navigate([CART_PATH]));
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
