import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, of, switchMap, tap } from 'rxjs';

import {
  Promobar,
  SiteHeader,
  SearchBar,
  CartLink,
  Breadcrumb,
  BreadcrumbItem,
  PageTitleRow,
  Pagination,
  PillGroup,
  PillOption,
  FilterSidebar,
  CategoryListItem,
  ProductCard,
  ProductRow,
  EmptyState,
  LoginPrompt,
} from '../../component';
import { CatalogApi } from '../../api';
import { ProductQuery } from '../../api/api.models';
import { CART_PATH, HOME_PATH } from '../../shared/paths';
import { injectCartState, injectSiteData } from '../../shared/page-state';
import { ProductViewData, toProductView } from '../../shared/product-view';
import {
  ALL_ERAS_LABEL,
  ALL_PRODUCTS_LABEL,
  DISPLAY_MODES,
  DisplayModeKey,
  ORDER_OPTIONS,
  PRICE_BANDS,
  VIEW_DEFAULT_ORDER,
  VIEW_HEADINGS,
} from './product-list.data';

/**
 * 網址查詢字串參數不存在時，router 會傳入 undefined（而非沿用 input 的預設值），
 * 因此統一轉成空字串，讓頁面狀態不必再處理 undefined。
 */
function orEmpty(value: string | undefined): string {
  return value ?? '';
}

/**
 * 網址查詢字串的 page 參數轉為頁碼；不存在或不是正整數時一律視為第 1 頁。
 */
function toPage(value: string | undefined): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/**
 * 商品列表頁面。
 * 統整頁首、麵包屑、標題列、篩選側欄與商品清單（卡片／橫列兩種顯示模式）；
 * 搜尋關鍵字、器類與主題入口由路由查詢字串帶入作為初始值，之後可由使用者
 * 操作覆寫，篩選與排序條件變動時重新向 API 取得符合條件的商品清單。
 */
@Component({
  selector: 'app-product-list',
  host: { class: 'store-app' },
  imports: [
    Promobar,
    SiteHeader,
    SearchBar,
    CartLink,
    Breadcrumb,
    PageTitleRow,
    Pagination,
    PillGroup,
    FilterSidebar,
    ProductCard,
    ProductRow,
    EmptyState,
    LoginPrompt,
  ],
  templateUrl: './product-list.html',
  styleUrls: [
    './product-list.scss',
  ],
})
export class ProductList {
  private readonly catalogApi = inject(CatalogApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** 購物車入口連結 */
  protected readonly cartHref = CART_PATH;

  /* ===============================
     網址查詢字串（由 router 的 component input binding 帶入）
     =============================== */

  /** 搜尋關鍵字 */
  q = input('', { transform: orEmpty });
  /** 器類名稱 */
  cat = input('', { transform: orEmpty });
  /** 年代代碼 */
  era = input('', { transform: orEmpty });
  /** 主題入口（deal 限時特賣／new 新品上架／exhibit 特展聯名） */
  view = input('', { transform: orEmpty });
  /** 頁碼，從 1 開始；分頁切換時會同步寫回網址查詢字串 */
  page = input(1, { transform: toPage });

  /* ===============================
     頁面狀態
     =============================== */

  /**
   * 以下四項以網址參數為初始值，之後可由使用者操作覆寫；
   * 網址參數變動時（例如從首頁再次點進不同器類）會重新以新值為準。
   */
  /** 搜尋框目前的輸入內容 */
  protected searchInput = linkedSignal(() => this.q());
  /** 已送出的搜尋關鍵字（按下 Enter 或搜尋鈕才更新） */
  protected keyword = linkedSignal(() => this.q());
  /** 目前選取的器類，空字串代表不限器類 */
  protected category = linkedSignal(() => this.cat());
  /** 目前選取的年代代碼，空字串代表不限年代 */
  protected eraCode = linkedSignal(() => this.era());
  /** 目前的主題入口，只影響頁面標題；清除篩選後歸零 */
  protected viewKey = linkedSignal(() => this.view());
  /** 目前的排序方式索引，預設值依主題入口而定（例如新品上架預設為最新上架） */
  protected sortIndex = linkedSignal(() => {
    const order = VIEW_DEFAULT_ORDER[this.view()];
    return order !== undefined ? ORDER_OPTIONS.findIndex((option) => option.order === order) : 0;
  });
  /** 是否只顯示折扣商品，由限時特賣入口進來時預設開啟 */
  protected dealOnly = linkedSignal(() => this.viewKey() === 'deal');
  /** 目前頁碼，初始值來自網址查詢字串；切換分頁或其他篩選條件變動時由 setPage 統一更新（含寫回網址） */
  protected pageIndex = linkedSignal(() => this.page());

  /** 目前選取的價格區間索引，0 為不篩選 */
  protected bandIndex = signal(0);
  /** 目前的顯示模式（卡片格狀／橫列清單） */
  protected mode = signal<DisplayModeKey>('grid');
  /** 購物車狀態（件數顯示於頁首） */
  protected readonly cart = injectCartState();

  /* ===============================
     固定版面文字與外部資料
     =============================== */

  /** 全站設定與頂部公告列資料 */
  protected readonly site = injectSiteData();
  /** 器類清單（含各器類商品件數） */
  private readonly categories = toSignal(this.catalogApi.getCategories(), { initialValue: [] });
  /** 年代清單（含各年代商品件數） */
  private readonly eras = toSignal(this.catalogApi.getEras(), { initialValue: [] });
  /** 價格區間選項文字 */
  protected readonly bandLabels = PRICE_BANDS.map((band) => band.label);
  /** 找不到商品時的空狀態文案 */
  protected readonly emptyTitle = '找不到符合條件的商品';
  protected readonly emptyDesc = '試著放寬價格區間，或改以紋樣、器類關鍵字搜尋。';
  protected readonly emptyCtaLabel = '清除篩選';

  /* ===============================
     篩選與查詢結果
     =============================== */

  /** 按下「重新載入」的次數，變動時以相同條件重新查詢 */
  private reloadCount = signal(0);
  /** 目前篩選條件對應的商品清單查詢參數 */
  private query = computed<ProductQuery & { reload: number }>(() => {
    const band = PRICE_BANDS[this.bandIndex()];
    return {
      cat: this.category() || undefined,
      era: this.eraCode() || undefined,
      q: this.keyword().trim() || undefined,
      order: ORDER_OPTIONS[this.sortIndex()].order,
      priceMin: band.min,
      priceMax: band.max,
      dealOnly: this.dealOnly() || undefined,
      page: this.pageIndex(),
      // 只為了讓「重新載入」能以相同條件再查一次；不會送到 API。
      reload: this.reloadCount(),
    };
  });
  /** 最近一次查詢是否失敗；失敗時顯示錯誤狀態，而不是「找不到符合條件的商品」 */
  protected loadError = signal(false);
  /** 符合目前篩選條件並已排序的商品；undefined 代表尚在載入，null 代表查詢失敗 */
  private result = toSignal(
    toObservable(this.query).pipe(
      switchMap((query) =>
        this.catalogApi.getProducts(query).pipe(
          tap((page) => {
            this.loadError.set(false);
            // 後端會把超出範圍的頁碼夾回最後一頁；同步回頁面與網址，避免分頁元件與實際資料不一致。
            if (page.page !== query.page) this.setPage(page.page);
          }),
          catchError(() => {
            this.loadError.set(true);
            return of(null);
          }),
        ),
      ),
    ),
  );

  /** ui-integration: API 尚未回應時顯示載入狀態，不把「0 件商品」誤讀成真的空清單。 */
  protected loading = computed(() => this.result() === undefined);

  /** 供卡片與橫列共用的商品顯示資料 */
  protected items = computed<ProductViewData[]>(() => (this.result()?.items ?? []).map(toProductView));
  /** 是否已載入且沒有任何符合條件的商品（查詢失敗不算） */
  protected isEmpty = computed(() => !!this.result() && this.items().length === 0);
  /** 查詢失敗時的錯誤狀態文案 */
  protected readonly errorTitle = '商品資料暫時無法載入';
  protected readonly errorDesc = '伺服器目前沒有回應，請稍後再試。';
  protected readonly errorCtaLabel = '重新載入';
  /** 是否使用卡片格狀顯示（有商品時才需判斷） */
  protected isGridMode = computed(() => this.mode() === 'grid');

  /** 每頁筆數，取自 API 回應；尚未載入時沿用後端預設值 20 */
  private pageSize = computed(() => this.result()?.pageSize ?? 20);
  /** 總頁數，至少為 1 */
  protected totalPages = computed(() => Math.max(1, Math.ceil((this.result()?.total ?? 0) / this.pageSize())));

  /** 目前選取年代的顯示名稱；年代清單尚未載入時暫用代碼 */
  private eraName = computed(() => {
    const code = this.eraCode();
    return code ? (this.eras().find((era) => era.code === code)?.name ?? code) : '';
  });

  /** 頁面標題：優先顯示年代與器類，其次為搜尋關鍵字，再其次為主題入口名稱 */
  protected heading = computed(() => {
    const filters = [this.eraName(), this.category()].filter(Boolean);
    if (filters.length > 0) return filters.join('・');

    const keyword = this.keyword().trim();
    if (keyword) return `「${keyword}」搜尋結果`;

    return VIEW_HEADINGS[this.viewKey()] ?? ALL_PRODUCTS_LABEL;
  });

  /** 麵包屑導覽項目，末項即目前頁面標題 */
  protected breadcrumbItems = computed<BreadcrumbItem[]>(() => [
    { label: '首頁', href: HOME_PATH },
    { label: this.heading() },
  ]);

  /** 商品件數說明文字：符合條件的總件數，而非本頁件數 */
  protected countLabel = computed(() => `${this.result()?.total ?? 0} 件商品`);

  /** 排序選項，選取狀態由 sortIndex 推導 */
  protected sortOptions = computed<PillOption[]>(() =>
    ORDER_OPTIONS.map((option, i) => ({ label: option.label, active: i === this.sortIndex() })),
  );

  /** 顯示模式切換選項，選取狀態由 mode 推導 */
  protected modeOptions = computed<PillOption[]>(() =>
    DISPLAY_MODES.map((displayMode) => ({
      label: displayMode.label,
      icon: displayMode.icon,
      title: displayMode.title,
      active: displayMode.key === this.mode(),
    })),
  );

  /**
   * 分類篩選項目，第一項為「全部商品」；其件數改採 getProducts 回應的 totalCount
   * （即目前篩選條件下的符合筆數），其餘器類件數則仍取自器類清單 API，不受其他篩選條件影響。
   */
  protected categoryItems = computed<CategoryListItem[]>(() => {
    const categories = this.categories();
    const selected = this.category();
    const allCount = this.result()?.total ?? categories.reduce((sum, item) => sum + item.productCount, 0);
    return [
      {
        name: ALL_PRODUCTS_LABEL,
        count: allCount,
        active: selected === '',
      },
      ...categories.map((item) => ({ name: item.name, count: item.productCount, active: selected === item.name })),
    ];
  });

  /** 年代篩選項目，第一項為「全部年代」；件數取自年代清單 API，不受其他篩選條件影響 */
  protected eraItems = computed<CategoryListItem[]>(() => {
    const eras = this.eras();
    if (eras.length === 0) return [];
    const selected = this.eraCode();
    return [
      {
        name: ALL_ERAS_LABEL,
        count: eras.reduce((sum, item) => sum + item.productCount, 0),
        active: selected === '',
      },
      ...eras.map((item) => ({ name: item.name, count: item.productCount, active: selected === item.code })),
    ];
  });

  /* ===============================
     使用者操作
     =============================== */

  /** 送出搜尋：改以關鍵字為主，同時解除器類與年代篩選，並回到第 1 頁 */
  protected onSearch(keyword: string): void {
    this.keyword.set(keyword);
    this.category.set('');
    this.eraCode.set('');
    this.setPage(1);
  }

  /** 切換器類篩選（索引 0 為「全部商品」），並回到第 1 頁 */
  protected onCategoryPick(index: number): void {
    this.category.set(index === 0 ? '' : this.categories()[index - 1].name);
    this.setPage(1);
  }

  /** 切換年代篩選（索引 0 為「全部年代」），並回到第 1 頁 */
  protected onEraPick(index: number): void {
    this.eraCode.set(index === 0 ? '' : this.eras()[index - 1].code);
    this.setPage(1);
  }

  /** 切換價格區間篩選，並回到第 1 頁 */
  protected onBandPick(index: number): void {
    this.bandIndex.set(index);
    this.setPage(1);
  }

  /** 切換「只看折扣商品」，並回到第 1 頁 */
  protected onDealToggle(): void {
    this.dealOnly.update((only) => !only);
    this.setPage(1);
  }

  /** 切換排序方式，並回到第 1 頁 */
  protected onSortPick(index: number): void {
    this.sortIndex.set(index);
    this.setPage(1);
  }

  /** 切換顯示模式 */
  protected onModePick(index: number): void {
    this.mode.set(DISPLAY_MODES[index].key);
  }

  /** 切換分頁，並移動至頁面頂端 */
  protected onPagePick(page: number): void {
    this.setPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** 清除所有篩選條件（排序方式保持不變），並回到第 1 頁 */
  protected onReset(): void {
    this.category.set('');
    this.eraCode.set('');
    this.bandIndex.set(0);
    this.dealOnly.set(false);
    this.searchInput.set('');
    this.keyword.set('');
    this.viewKey.set('');
    this.setPage(1);
  }

  /** 查詢失敗後以相同條件重新查詢 */
  protected onReload(): void {
    this.reloadCount.update((count) => count + 1);
  }

  /** 加入購物車：數量 1 */
  protected onAddToCart(productId: string): void {
    this.cart.add(productId);
  }

  /**
   * 更新目前頁碼並同步寫回網址查詢字串（page），使分頁狀態可透過網址控制、分享或重新整理後維持；
   * 第 1 頁時省略 page 參數以維持網址簡潔。
   */
  private setPage(page: number): void {
    this.pageIndex.set(page);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: page > 1 ? page : null },
      queryParamsHandling: 'merge',
    });
  }
}
