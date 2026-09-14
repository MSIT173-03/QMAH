import { Component, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { map, of, switchMap } from 'rxjs';

import { Promobar, SearchBar, SearchSuggestion, CartLink, SiteFooter, SiteHeader } from '../../component';
import { CatalogApi, HomeApi, SearchApi } from '../../api';
import { KeywordSuggestion } from '../../api/api.models';
import { CART_PATH, PRODUCT_LIST_PATH, searchPath } from '../../shared/paths';
import { injectCartState, injectSiteData } from '../../shared/page-state';
import { toProductView } from '../../shared/product-view';
import { StoreLink } from '../../shared/store-link';

import { HeroCarousel } from './hero-carousel/hero-carousel';
import { FlashSale } from './flash-sale/flash-sale';
import { MiniCoupons } from './mini-coupons/mini-coupons';
import { CategoryGrid } from './category-grid/category-grid';
import { RankingSection } from './ranking-section/ranking-section';
import { NewArrivals } from './new-arrivals/new-arrivals';
import { BrandHall } from './brand-hall/brand-hall';
import { Recommendations } from './recommendations/recommendations';
import { BadgedProductView } from './home.data';

/** 「為你推薦」每次載入的商品數量 */
const RECOMMEND_PAGE_SIZE = 10;

/**
 * 首頁。
 * 統整頁首搜尋、主視覺輪播、限時特賣、迷你折價券、分類入口、熱銷排行、
 * 新品上架、品牌館與為你推薦等各版位；購物車、搜尋建議、全站設定與會員資料
 * 皆由本頁面向 API 取得，「為你推薦」並在此逐頁載入並累加。
 */
@Component({
  selector: 'app-home',
  host: { class: 'store-app' },
  imports: [
    Promobar,
    SearchBar,
    CartLink,
    SiteFooter,
    HeroCarousel,
    FlashSale,
    MiniCoupons,
    CategoryGrid,
    RankingSection,
    NewArrivals,
    BrandHall,
    Recommendations,
    SiteHeader,
    StoreLink,
  ],
  templateUrl: './home.html',
  styleUrls: [
    './home.scss',
  ],
})
export class Home {
  private readonly router = inject(Router);
  private readonly homeApi = inject(HomeApi);
  private readonly searchApi = inject(SearchApi);

  /** 購物車狀態（件數顯示於頁首） */
  protected readonly cart = injectCartState();
  protected readonly cartPath = CART_PATH;

  /** 全站設定與會員資料，供頂部公告列與頁尾使用 */
  protected readonly site = injectSiteData();

  /** 搜尋框目前輸入值 */
  protected searchQuery = signal('');
  /** 搜尋框旁的熱門搜尋捷徑連結 */
  protected readonly hotLinks = toSignal(this.searchApi.getHotLinks(), { initialValue: [] });
  /** 依目前輸入內容即時查詢的搜尋建議清單 */
  protected suggestions = toSignal(
    toObservable(this.searchQuery).pipe(
      switchMap((value) => {
        const q = value.trim();
        return q ? this.searchApi.getSuggestions(q) : of<KeywordSuggestion[]>([]);
      }),
      map((list): SearchSuggestion[] =>
        list.map((item) => ({ name: item.keyword, count: `${item.productCount} 件` })),
      ),
    ),
    { initialValue: [] },
  );

  /** 分類導覽列顯示用分類名稱 */
  protected readonly categoryNames = toSignal(
    inject(CatalogApi)
      .getCategories()
      .pipe(map((categories) => categories.map((category) => category.name))),
    { initialValue: [] },
  );
  /** 分類導覽列「新品上架」與各分類的連結網址 */
  protected readonly newArrivalsPath = `${PRODUCT_LIST_PATH}?view=new`;
  protected categoryPath(name: string): string {
    return `${PRODUCT_LIST_PATH}?cat=${encodeURIComponent(name)}`;
  }

  /** 「為你推薦」已載入的商品卡片 */
  protected recommendedItems = signal<BadgedProductView[]>([]);
  /** 「為你推薦」已載入的頁數 */
  private recommendPage = 0;

  constructor() {
    this.loadRecommendations();
  }

  /** 加入購物車：數量 1 */
  protected onAddToCart(productId: string): void {
    this.cart.add(productId);
  }

  /** 送出搜尋：前往商品列表頁，並帶上關鍵字查詢字串 */
  protected onSearch(keyword: string): void {
    this.router.navigateByUrl(searchPath(keyword));
  }

  /** 選取搜尋建議：以建議的關鍵字搜尋 */
  protected onSuggestionPick(suggestion: SearchSuggestion): void {
    this.onSearch(suggestion.name);
  }

  /** 「載入更多」：取得下一頁推薦商品並接在清單後面 */
  protected onRequireMore(): void {
    this.loadRecommendations();
  }

  protected onClickAllCategory() {}

  protected onClickSpecial() {}

  protected onClickOnSell() {}

  /** 請求「為你推薦」的商品資料並加入目前列表。 */
  private loadRecommendations(): void {
    this.recommendPage += 1;
    this.homeApi
      .getRecommendations({ page: this.recommendPage, pageSize: RECOMMEND_PAGE_SIZE })
      .subscribe((page) =>
        this.recommendedItems.update((items) => [
          ...items,
          ...page.items.map(
            (item): BadgedProductView => ({ ...toProductView(item), badge: item.reason, badgeVariant: 'teal' }),
          ),
        ]),
      );
  }
}
