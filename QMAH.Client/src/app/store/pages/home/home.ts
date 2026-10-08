import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { SearchBar, SessionBar, SiteHeader } from '../../component';
import { HomeApi } from '../../api';
import { searchPath } from '../../shared/paths';
import { injectCartState } from '../../shared/page-state';
import { PurchasedProducts } from '../../shared/purchased-products';
import { toProductView } from '../../shared/product-view';

import { HeroCarousel } from './hero-carousel/hero-carousel';
import { CategoryGrid } from './category-grid/category-grid';
import { RankingSection } from './ranking-section/ranking-section';
import { NewArrivals } from './new-arrivals/new-arrivals';
import { EraGrid } from './era-grid/era-grid';
import { Recommendations } from './recommendations/recommendations';
import { ScrollTop } from '../../component/scroll-top/scroll-top';
import { BadgedProductView, HOME_PRODUCT_COUNT } from './home.data';

/**
 * 首頁。
 * 統整頁首搜尋、主視覺輪播、分類入口、年代選藏、熱銷排行、新品上架與為你推薦等版位。
 * 各版位自行向 API 取得資料；本頁面持有購物車狀態（加入購物車）與搜尋框，
 * 並一次取得「為你推薦」的商品。
 */
@Component({
  selector: 'app-home',
  host: { class: 'store-app' },
  imports: [ScrollTop, 
    SessionBar,
    SearchBar,
    HeroCarousel,
    CategoryGrid,
    RankingSection,
    NewArrivals,
    EraGrid,
    Recommendations,
    SiteHeader,
  ],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly router = inject(Router);
  private readonly homeApi = inject(HomeApi);
  private readonly purchased = inject(PurchasedProducts);

  /** 購物車狀態（件數顯示於頁首） */
  protected readonly cart = injectCartState();

  /** 「為你推薦」已載入的商品卡片 */
  protected recommendedItems = signal<BadgedProductView[]>([]);

  constructor() {
    this.purchased.ensureLoaded();
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

  /** 請求「為你推薦」的商品資料（一次取 HOME_PRODUCT_COUNT 件，實際顯示幾件由版位的欄數與固定行數決定）。 */
  private loadRecommendations(): void {
    this.homeApi
      .getRecommendations({ page: 1, pageSize: HOME_PRODUCT_COUNT })
      .subscribe((page) =>
        this.recommendedItems.set(
          page.items.map(
            (item): BadgedProductView => ({ ...toProductView(item), badge: item.reason, badgeVariant: 'teal' }),
          ),
        ),
      );
  }
}
