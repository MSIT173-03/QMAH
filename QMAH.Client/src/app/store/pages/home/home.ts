import { Component, computed, inject, signal } from '@angular/core'
import { toObservable, toSignal } from '@angular/core/rxjs-interop'
import { RouterLink } from '@angular/router'
import { map, of, switchMap } from 'rxjs'

import { Promobar, SearchBar, SearchSuggestion, CartLink, SiteFooter, SiteHeader, } from "../../component"
import { PRODUCT_LIST_PATH } from '../../shared/paths'

import { HeroCarousel } from './hero-carousel/hero-carousel'
import { FlashSale } from './flash-sale/flash-sale'
import { MiniCoupons } from './mini-coupons/mini-coupons'
import { CategoryGrid } from './category-grid/category-grid'
import { RankingSection } from './ranking-section/ranking-section'
import { NewArrivals } from './new-arrivals/new-arrivals'
import { BrandHall } from './brand-hall/brand-hall'
import { Recommendations } from './recommendations/recommendations'

import { CartApi } from '../../api/cart.api'
import { CatalogApi } from '../../api/catalog.api'
import { HomeApi } from '../../api/home.api'
import { MemberApi } from '../../api/member.api'
import { SearchApi } from '../../api/search.api'
import { SiteApi } from '../../api/site.api'
import { KeywordSuggestion, ShoppingCart } from '../../api/api.models'

import { CART_PATH } from "../../shared/paths"

import { ProductCardData, toCardData } from './home.data'



/** 「為你推薦」每次載入的商品數量 */
const RECOMMEND_PAGE_SIZE = 10

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
    RouterLink,
  ],
  templateUrl: './home.html',
  styleUrls: [
    './home.scss'
  ],
})
export class Home {
  private readonly cartApi: CartApi = inject(CartApi)
  private readonly homeApi: HomeApi = inject(HomeApi)
  private readonly memberApi: MemberApi = inject(MemberApi)
  private readonly searchApi: SearchApi = inject(SearchApi)

  /** 購物車內容，取得後與加入購物車時更新 */
  private readonly cart = signal<ShoppingCart | null>(null)
  /** 購物車內商品數量 */
  protected cartCount = computed(() => this.cart()?.items.reduce((sum, item) => sum + item.qty, 0) ?? 0)
  protected readonly cartPath = CART_PATH

  /** 搜尋框目前輸入值 */
  protected searchQuery = signal('')
  /** 搜尋框旁的熱門搜尋捷徑連結 */
  protected readonly hotLinks = toSignal(this.searchApi.getHotLinks(), { initialValue: [] })
  /** 依目前輸入內容即時查詢的搜尋建議清單 */
  protected suggestions = toSignal(
    toObservable(this.searchQuery).pipe(
      switchMap((value) => {
        const q = value.trim()
        return q ? this.searchApi.getSuggestions(q) : of<KeywordSuggestion[]>([])
      }),
      map((list): SearchSuggestion[] =>
        list.map((item) => ({ name: item.keyword, count: `${item.productCount} 件` })),
      ),
    ),
    { initialValue: [] },
  )

  /** 全站設定與會員資料，供頂部公告列與頁尾使用 */
  private readonly siteConfig = toSignal(inject(SiteApi).getConfig())
  private readonly profile = toSignal(this.memberApi.getProfile())

  /** 頂部公告列的公告文字、會員點數與折價券 */
  protected announcements = computed(() => this.siteConfig()?.promoAnnouncements ?? [])
  protected points = computed(() => (this.profile()?.pointBalance ?? 0).toLocaleString('en-US'))
  protected readonly coupons = toSignal(this.memberApi.getCoupons(), { initialValue: [] })
  /** 頁尾連結欄位 */
  protected footerColumns = computed(() => this.siteConfig()?.footerColumns ?? [])

  /** 分類導覽列顯示用分類名稱 */
  protected readonly categoryNames = toSignal(
    inject(CatalogApi)
      .getCategories()
      .pipe(map((categories) => categories.map((category) => category.name))),
    { initialValue: [] },
  )
  /** 商品列表頁路徑，供「新品上架」與各分類連結使用（各自帶對應的 view／cat 查詢字串） */
  protected readonly productsPath = PRODUCT_LIST_PATH

  /** 「為你推薦」已載入的商品卡片 */
  protected recommendedItems = signal<ProductCardData[]>([])
  /** 「為你推薦」已載入的頁數 */
  private recommendPage: number = 0

  constructor() {
    this.cartApi.getCart().subscribe((cart) => this.cart.set(cart))
    this.loadRecommendations()
  }

  /** 加入購物車：數量 1 */
  protected onAddToCart(productId: string): void {
    this.cartApi.addItem(productId, 1).subscribe((cart) => this.cart.set(cart))
  }

  /** 「載入更多」：取得下一頁推薦商品並接在清單後面 */
  protected onRequireMore(): void {
    this.loadRecommendations()
  }

  protected onClickAllCategory() { }

  protected onClickSpecial() { }

  protected onClickOnSell() { }

  /** 請求「為你推薦」的商品資料並加入目前列表。 */
  private loadRecommendations(): void {
    this.recommendPage += 1
    this.homeApi
      .getRecommendations({ page: this.recommendPage, pageSize: RECOMMEND_PAGE_SIZE })
      .subscribe((page) =>
        this.recommendedItems.update((items) => [
          ...items,
          ...page.items.map((item) => toCardData(item, item.reason, 'teal')),
        ]),
      )
  }
}
