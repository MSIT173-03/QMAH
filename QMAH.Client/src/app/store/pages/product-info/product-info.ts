import { Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';

import { Promobar } from '../../component/promobar/promobar';
import { SiteHeader } from '../../component/site-header/site-header';
import { SearchBar } from '../../component/search-bar/search-bar';
import { HeaderActions, HeaderNavLink } from '../../component/header-actions/header-actions';
import { CartLink } from '../../component/cart-link/cart-link';
import { Breadcrumb, BreadcrumbItem } from '../../component/breadcrumb/breadcrumb';
import { EmptyState } from '../../component/empty-state/empty-state';
import { SiteFooter } from '../../component/site-footer/site-footer';
import { ProductGallery } from './product-gallery/product-gallery';
import { ProductSummary } from './product-summary/product-summary';
import { ProductDetail } from './product-detail/product-detail';
import { ProductReviews } from './product-reviews/product-reviews';
import { RelatedProducts } from './related-products/related-products';
import { CartApi } from '../../api/cart.api';
import { CatalogApi } from '../../api/catalog.api';
import { MemberApi } from '../../api/member.api';
import { SiteApi } from '../../api/site.api';
import { Product, ShoppingCart } from '../../api/api.models';
import { CART_PATH, CHECKOUT_PATH, HOME_PATH, PRODUCT_LIST_PATH } from '../../shared/paths';
import { RELATED_LIMIT, REVIEW_FILTERS, toRelatedItemData } from './product-info.data';

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
  private readonly cartApi = inject(CartApi);
  private readonly memberApi = inject(MemberApi);

  /* ===============================
     網址路徑參數（由 router 的 component input binding 帶入）
     =============================== */

  /** 商品 ID */
  id = input('');

  /* ===============================
     頁面狀態
     =============================== */

  /** 購物車內容，取得後與加入購物車時更新 */
  private readonly cart = signal<ShoppingCart | null>(null);
  /** 購物車件數 */
  protected cartCount = computed(() => this.cart()?.items.reduce((sum, item) => sum + item.qty, 0) ?? 0);
  /** 頁首搜尋框目前輸入值 */
  protected searchQuery = signal('');
  /** 目前選取的評價篩選條件索引（對應 REVIEW_FILTERS） */
  protected reviewFilter = signal(0);

  /* ===============================
     固定版面文字與外部資料
     =============================== */

  private readonly siteConfig = toSignal(inject(SiteApi).getConfig());
  private readonly profile = toSignal(this.memberApi.getProfile());
  /** 頂部公告列的公告文字、會員點數與折價券 */
  protected announcements = computed(() => this.siteConfig()?.promoAnnouncements ?? []);
  protected points = computed(() => (this.profile()?.pointBalance ?? 0).toLocaleString('en-US'));
  protected readonly coupons = toSignal(this.memberApi.getCoupons(), { initialValue: [] });
  /** 尺寸量測說明與商品政策條列（全站共通文案） */
  protected sizeNote = computed(() => this.siteConfig()?.sizeNote ?? '');
  protected policies = computed(() => this.siteConfig()?.productPolicies ?? []);

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
    return item && item.discountRate > 0 ? item.price : null;
  });
  /** 商品圖片的視角名稱清單 */
  protected galleryViews = computed(() => this.item()?.images.map((image) => image.view) ?? []);

  /** 同類推薦清單 */
  protected related = toSignal(
    toObservable(this.id).pipe(
      switchMap((id) =>
        this.catalogApi.getRelated(id, RELATED_LIMIT).pipe(catchError(() => of<Product[]>([]))),
      ),
      map((items) => items.map(toRelatedItemData)),
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

  constructor() {
    this.cartApi.getCart().subscribe((cart) => this.cart.set(cart));
  }

  /* ===============================
     使用者操作
     =============================== */

  /** 加入購物車：依選購數量加入目前商品 */
  protected onAddToCart(qty: number): void {
    const item = this.item();
    if (item) this.addToCart(item.id, qty);
  }

  /** 直接購買：先加入購物車，之後應改為導向結帳流程 */
  protected onBuyNow(qty: number): void {
    const item = this.item()
    if (!item) return

    this.cartApi.addItem(item.id, qty)
      .subscribe((cart) => {
        this.cart.set(cart)
        this.router.navigate([CHECKOUT_PATH])
      })
  }

  /** 從同類推薦加入購物車：數量 1 */
  protected onAddRelated(productId: string): void {
    this.addToCart(productId, 1);
  }

  /** 送出頁首搜尋：前往商品列表頁，並帶上關鍵字查詢字串 */
  protected onSearch(keyword: string): void {
    this.router.navigate([PRODUCT_LIST_PATH], { queryParams: { q: keyword } });
  }

  private addToCart(productId: string, qty: number): void {
    this.cartApi.addItem(productId, qty).subscribe((cart) => this.cart.set(cart));
  }
}
