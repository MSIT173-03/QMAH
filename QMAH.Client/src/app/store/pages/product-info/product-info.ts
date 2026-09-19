import { Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';

import {
  Promobar,
  SiteHeader,
  SearchBar,
  HeaderActions,
  HeaderNavLink,
  CartLink,
  Breadcrumb,
  BreadcrumbItem,
  EmptyState,
  SiteFooter,
} from '../../component';
import { CatalogApi } from '../../api';
import { Product } from '../../api/api.models';
import { CART_PATH, CHECKOUT_PATH, HOME_PATH, PRODUCT_LIST_PATH } from '../../shared/paths';
import { injectCartState, injectSiteData } from '../../shared/page-state';
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
    Promobar,
    SiteHeader,
    SearchBar,
    HeaderActions,
    CartLink,
    Breadcrumb,
    EmptyState,
    SiteFooter,
    ProductGallery,
    ProductSummary,
    ProductDetail,
    ProductReviews,
    RelatedProducts,
  ],
  templateUrl: './product-info.html',
  styleUrls: [
    './product-info.scss',
  ],
})
export class ProductInfo {
  private readonly router = inject(Router);
  private readonly catalogApi = inject(CatalogApi);

  /* ===============================
     網址路徑參數（由 router 的 component input binding 帶入）
     =============================== */

  /** 商品 ID */
  id = input('');

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

  /** 全站設定與頂部公告列資料 */
  protected readonly site = injectSiteData();
  /** 尺寸量測說明與商品政策條列（全站共通文案） */
  protected sizeNote = computed(() => this.site.config()?.sizeNote ?? '');
  protected policies = computed(() => this.site.config()?.productPolicies ?? []);

  /** 購物車入口連結 */
  protected readonly cartHref = CART_PATH;
  /** 商品列表頁路徑，供「查無此商品」時的返回按鈕使用 */
  protected readonly productsPath = PRODUCT_LIST_PATH;

  /** 頁首導覽連結 */
  protected readonly navLinks: HeaderNavLink[] = [
    { label: '全部分類', href: PRODUCT_LIST_PATH },
    { label: '特展聯名', href: `${PRODUCT_LIST_PATH}?view=exhibit` },
    { label: '品牌館', href: `${HOME_PATH}#brands` },
  ];

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
  /** 商品圖片的視角名稱清單 */
  protected galleryViews = computed(() => this.item()?.images.map((image) => image.view) ?? []);
  /** 商品圖片網址清單（與視角同序），來自 API 的 primaryImagePath */
  protected galleryImages = computed(() => this.item()?.images.map((image) => image.url) ?? []);

  /** 同類推薦清單 */
  protected related = toSignal(
    toObservable(this.id).pipe(
      switchMap((id) =>
        this.catalogApi.getRelated(id, RELATED_LIMIT).pipe(catchError(() => of<Product[]>([]))),
      ),
      map((items) => items.map(toProductView)),
    ),
    { initialValue: [] },
  );

  /** 目前商品在選取的篩選條件下的評價回應 */
  private readonly reviewPage = toSignal(
    toObservable(computed(() => ({ id: this.id(), filter: REVIEW_FILTERS[this.reviewFilter()] }))).pipe(
      switchMap(({ id, filter }) =>
        this.catalogApi.getReviews(id, filter.query).pipe(catchError(() => of(null))),
      ),
    ),
  );
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
      { label: item.category, href: `${PRODUCT_LIST_PATH}?cat=${encodeURIComponent(item.category)}` },
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

  /** 直接購買：先加入購物車，之後應改為導向結帳流程 */
  protected onBuyNow(qty: number): void {
    const item = this.item();
    if (!item) return;
    this.cart.add(item.id, qty, () => this.router.navigate([CHECKOUT_PATH]));
  }

  /** 從同類推薦加入購物車：數量 1 */
  protected onAddRelated(productId: string): void {
    this.cart.add(productId);
  }

  /** 送出頁首搜尋：前往商品列表頁，並帶上關鍵字查詢字串 */
  protected onSearch(keyword: string): void {
    this.router.navigate([PRODUCT_LIST_PATH], { queryParams: { q: keyword } });
  }
}
