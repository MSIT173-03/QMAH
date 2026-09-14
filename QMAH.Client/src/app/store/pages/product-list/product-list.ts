import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';

import {
  Promobar,
  SiteHeader,
  SearchBar,
  CartLink,
  Breadcrumb,
  BreadcrumbItem,
  PageTitleRow,
  PillGroup,
  PillOption,
  FilterSidebar,
  CategoryListItem,
  ProductCard,
  ProductRow,
  EmptyState,
  SiteFooter,
} from '../../component';
import { CatalogApi } from '../../api';
import { ProductQuery } from '../../api/api.models';
import { CART_PATH, HOME_PATH } from '../../shared/paths';
import { injectCartState, injectSiteData } from '../../shared/page-state';
import { ProductViewData, toProductView } from '../../shared/product-view';
import {
  ALL_PRODUCTS_LABEL,
  DISPLAY_MODES,
  DisplayModeKey,
  PRICE_BANDS,
  SORT_OPTIONS,
  VIEW_DEFAULT_SORT,
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
    PillGroup,
    FilterSidebar,
    ProductCard,
    ProductRow,
    EmptyState,
    SiteFooter,
  ],
  templateUrl: './product-list.html',
  styleUrls: [
    './product-list.scss',
  ],
})
export class ProductList {
  private readonly catalogApi = inject(CatalogApi);

  /** 購物車入口連結 */
  protected readonly cartHref = CART_PATH;

  /* ===============================
     網址查詢字串（由 router 的 component input binding 帶入）
     =============================== */

  /** 搜尋關鍵字 */
  q = input('', { transform: orEmpty });
  /** 器類名稱 */
  cat = input('', { transform: orEmpty });
  /** 主題入口（deal 限時特賣／new 新品上架／exhibit 特展聯名） */
  view = input('', { transform: orEmpty });

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
  /** 目前的主題入口，只影響頁面標題；清除篩選後歸零 */
  protected viewKey = linkedSignal(() => this.view());
  /** 目前的排序方式索引，預設值依主題入口而定（例如新品上架預設為最新上架） */
  protected sortIndex = linkedSignal(() => {
    const key = VIEW_DEFAULT_SORT[this.view()];
    return key ? SORT_OPTIONS.findIndex((option) => option.key === key) : 0;
  });
  /** 是否只顯示折扣商品，由限時特賣入口進來時預設開啟 */
  protected dealOnly = linkedSignal(() => this.viewKey() === 'deal');

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
  /** 價格區間選項文字 */
  protected readonly bandLabels = PRICE_BANDS.map((band) => band.label);
  /** 找不到商品時的空狀態文案 */
  protected readonly emptyTitle = '找不到符合條件的商品';
  protected readonly emptyDesc = '試著放寬價格區間，或改以紋樣、器類關鍵字搜尋。';
  protected readonly emptyCtaLabel = '清除篩選';

  /* ===============================
     篩選與查詢結果
     =============================== */

  /** 目前篩選條件對應的商品清單查詢參數 */
  private query = computed<ProductQuery>(() => {
    const band = PRICE_BANDS[this.bandIndex()];
    return {
      cat: this.category() || undefined,
      q: this.keyword().trim() || undefined,
      sort: SORT_OPTIONS[this.sortIndex()].key,
      priceMin: band.min,
      priceMax: band.max,
      dealOnly: this.dealOnly() || undefined,
    };
  });
  /** 符合目前篩選條件並已排序的商品；undefined 代表尚在載入 */
  private result = toSignal(
    toObservable(this.query).pipe(switchMap((query) => this.catalogApi.getProducts(query))),
  );

  /** 供卡片與橫列共用的商品顯示資料 */
  protected items = computed<ProductViewData[]>(() => (this.result()?.items ?? []).map(toProductView));
  /** 是否已載入且沒有任何符合條件的商品 */
  protected isEmpty = computed(() => this.result() !== undefined && this.items().length === 0);
  /** 是否使用卡片格狀顯示（有商品時才需判斷） */
  protected isGridMode = computed(() => this.mode() === 'grid');

  /** 頁面標題：優先顯示器類，其次為搜尋關鍵字，再其次為主題入口名稱 */
  protected heading = computed(() => {
    const category = this.category();
    if (category) return category;

    const keyword = this.keyword().trim();
    if (keyword) return `「${keyword}」搜尋結果`;

    return VIEW_HEADINGS[this.viewKey()] ?? ALL_PRODUCTS_LABEL;
  });

  /** 麵包屑導覽項目，末項即目前頁面標題 */
  protected breadcrumbItems = computed<BreadcrumbItem[]>(() => [
    { label: '首頁', href: HOME_PATH },
    { label: this.heading() },
  ]);

  /** 商品件數說明文字 */
  protected countLabel = computed(() => `${this.items().length} 件商品`);

  /** 排序選項，選取狀態由 sortIndex 推導 */
  protected sortOptions = computed<PillOption[]>(() =>
    SORT_OPTIONS.map((option, i) => ({ label: option.label, active: i === this.sortIndex() })),
  );

  /** 顯示模式切換選項，選取狀態由 mode 推導 */
  protected modeOptions = computed<PillOption[]>(() =>
    DISPLAY_MODES.map((displayMode) => ({
      label: displayMode.label,
      title: displayMode.title,
      active: displayMode.key === this.mode(),
    })),
  );

  /** 分類篩選項目，第一項為「全部商品」；件數不受其他篩選條件影響（與設計稿一致） */
  protected categoryItems = computed<CategoryListItem[]>(() => {
    const categories = this.categories();
    const selected = this.category();
    return [
      {
        name: ALL_PRODUCTS_LABEL,
        count: categories.reduce((sum, item) => sum + item.productCount, 0),
        active: selected === '',
      },
      ...categories.map((item) => ({ name: item.name, count: item.productCount, active: selected === item.name })),
    ];
  });

  /* ===============================
     使用者操作
     =============================== */

  /** 送出搜尋：改以關鍵字為主，同時解除器類篩選 */
  protected onSearch(keyword: string): void {
    this.keyword.set(keyword);
    this.category.set('');
  }

  /** 切換器類篩選（索引 0 為「全部商品」） */
  protected onCategoryPick(index: number): void {
    this.category.set(index === 0 ? '' : this.categories()[index - 1].name);
  }

  /** 切換「只看折扣商品」 */
  protected onDealToggle(): void {
    this.dealOnly.update((only) => !only);
  }

  /** 切換顯示模式 */
  protected onModePick(index: number): void {
    this.mode.set(DISPLAY_MODES[index].key);
  }

  /** 清除所有篩選條件（排序方式保持不變） */
  protected onReset(): void {
    this.category.set('');
    this.bandIndex.set(0);
    this.dealOnly.set(false);
    this.searchInput.set('');
    this.keyword.set('');
    this.viewKey.set('');
  }

  /** 加入購物車：數量 1 */
  protected onAddToCart(productId: string): void {
    this.cart.add(productId);
  }
}
