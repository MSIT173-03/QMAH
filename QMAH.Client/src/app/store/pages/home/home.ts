import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { map, of, switchMap } from 'rxjs';

import { Promobar, SearchBar, SearchSuggestion, CartLink, SiteFooter, SiteHeader } from '../../component';
import { SearchApi } from '../../api';
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
import { TopRated } from './top-rated/top-rated';
import { Recommendations } from './recommendations/recommendations';
import { BadgedProductView } from './home.data';

/**
 * 首頁。
 * 統整頁首搜尋、主視覺輪播、限時特賣、迷你折價券、分類入口、熱銷排行、
 * 新品上架、評價排行與為你推薦等各版位；購物車、搜尋建議、全站設定與會員資料
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
    TopRated,
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
  private readonly searchApi = inject(SearchApi);

  /** 購物車狀態（件數顯示於頁首） */
  protected readonly cart = injectCartState();
  protected readonly cartPath = CART_PATH;

  /** 全站設定與會員資料，供頂部公告列與頁尾使用 */
  protected readonly site = injectSiteData();

  /** 各器類商品數量，供分類入口區塊使用 */
  protected readonly categoryCounts = computed(() => this.site.info()?.categoryCounts ?? {});
  /** 各器類封面圖（銷售數量最高商品的主圖） */
  protected readonly categoryImages = computed(() => this.site.info()?.categoryCoverImages ?? {});
  /** 熱銷排行、新品上架與評價排行的商品（來自 products/info） */
  protected readonly hotProducts = computed(() => this.site.info()?.hotProducts ?? []);
  protected readonly newProducts = computed(() => this.site.info()?.newProducts ?? []);
  protected readonly topRatedProducts = computed(() => this.site.info()?.topRatedProducts ?? []);

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
  protected readonly categoryNames = computed(() => Object.keys(this.site.info()?.categoryCounts ?? {}));
  /** 分類導覽列「新品上架」與各分類的連結網址 */
  protected readonly newArrivalsPath = `${PRODUCT_LIST_PATH}?view=new`;
  protected categoryPath(name: string): string {
    return `${PRODUCT_LIST_PATH}?cat=${encodeURIComponent(name)}`;
  }

  /** 「為你推薦」商品卡片（來自 products/info，隨機 10 項），角標為器類 */
  protected readonly recommendedItems = computed((): BadgedProductView[] =>
    (this.site.info()?.recommendedProducts ?? []).map((item) => ({
      ...toProductView(item),
      badge: item.category,
      badgeVariant: 'teal',
    })),
  );

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

  protected onClickAllCategory() {}

  protected onClickSpecial() {}

  protected onClickOnSell() {}
}
