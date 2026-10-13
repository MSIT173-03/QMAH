import { Component, computed, inject, input, output } from '@angular/core';
import { CatalogApi } from '../../api/catalog.api';
import { QmahIconComponent } from '../../../shared/components/qmah-icon/qmah-icon';
import { bumpAddToCart } from '../../shared/bump';
import { formatNumber } from '../../shared/format';
import { imageWithFallback } from '../../shared/image-utils';
import { productPath } from '../../shared/paths';
import { NO_REVIEWS_LABEL, formatRating, formatReviews, toPriceView } from '../../shared/product-view';
import { StoreLink } from '../../shared/store-link';

/** 角標樣式變體 */
export type ProductCardBadgeVariant = 'ink' | 'teal' | 'rank' | 'rank-1' | 'rank-2' | 'rank-3';

/**
 * 商品卡片版面變體。
 * default：首頁格狀卡片；
 * list：商品列表頁格狀卡片（圖片佔位文字較深）；
 * compact：僅顯示品牌／名稱／價格，用於購物車「再加購」等次要情境。
 */
export type ProductCardVariant = 'default' | 'list' | 'compact';

/** 商品卡片：封面圖、角標、品牌與名稱、價格、評分與加入購物車按鈕，版面依 variant 切換。 */
@Component({
  selector: 'app-product-card',
  imports: [StoreLink, QmahIconComponent],
  templateUrl: './product-card.html',
  styleUrl: './product-card.scss',
})
export class ProductCard {
  id = input('');

  /** 版面變體 */
  variant = input<ProductCardVariant>('default');

  /** 商品圖片網址；讀取失敗時先嘗試同目錄的 display 圖，再顯示「影像待補」 */
  coverImage = input<string | null>(null);

  /** 角標文字（例如「#01」「新品」），為 null 時不顯示 */
  badge = input<string | null>(null);
  /** 角標樣式變體 */
  badgeVariant = input<ProductCardBadgeVariant>('ink');
  /** 角標的器類色調名稱（與分類入口卡片同一組顏色），有值時角標前面加該色的圓點 */
  badgeTone = input<string | null>(null);

  /** 品牌名稱，為 null 時不顯示 */
  brand = input<string | null>(null);
  /** 商品名稱 */
  name = input('');

  /** 折扣後售價 */
  price = input(0);
  /** 折扣前原價，為 null 時代表無折扣（不顯示劃線價與標籤） */
  was = input<number | null>(null);

  /** 評分 */
  rating = input(0);
  /** 評論數 */
  reviews = input(0);
  /** 已售數量，為 null 時卡片最後一行不顯示已售資訊 */
  sold = input<number | null>(null);

  /** 點擊加入購物車按鈕時觸發 */
  addToCart = output<void>();
  /** 滑鼠移入、聚焦或觸控時先預載商品詳情 */
  private readonly catalog = inject(CatalogApi);
  protected prefetch(): void { this.catalog.prefetchProduct(this.id()); }
  /** 已加入購物車：按鈕維持反白並在右下角顯示打勾（購物車頁「再加購」使用） */
  added = input(false);

  /** 無圖片時顯示的文字 */
  protected readonly slotLabel = '影像待補';
  /** 加入購物車按鈕文字 */
  protected readonly addCartLabel = '加入購物車';

  /** 商品圖片；讀取失敗時先改用同一件文物的 display 圖，仍失敗才顯示佔位狀態 */
  protected readonly image = imageWithFallback(() => this.coverImage());

  /** 商品頁連結網址 */
  protected link = computed(() => productPath(this.id()));
  /** 是否為精簡版（僅顯示品牌／名稱／價格） */
  protected isCompact = computed(() => this.variant() === 'compact');
  /** 圖片佔位文字是否使用較深的顏色（首頁以外的版面皆較深） */
  protected isFaintSlot = computed(() => this.variant() !== 'default');

  /** 價格列顯示字串 */
  protected priceView = computed(() => toPriceView(this.price(), this.was()));
  /** 評分顯示字串 */
  protected ratingText = computed(() => formatRating(this.rating()));
  /** 評論數顯示字串 */
  protected reviewsText = computed(() => formatReviews(this.reviews()));
  /** 是否有評論；沒有評論時不顯示「0.0」「0 則評論」，改顯示提示文字 */
  protected hasReviews = computed(() => this.reviews() > 0);
  /** 尚無評論時的提示文字 */
  protected readonly noReviewsLabel = NO_REVIEWS_LABEL;
  /** 星級填滿的百分比（評分 ÷ 5） */
  protected fillPercent = computed(() => Math.max(0, Math.min(100, (this.rating() / 5) * 100)));
  /** 已售數量顯示字串，未提供時為 null */
  protected soldText = computed(() => {
    const sold = this.sold();
    return sold === null ? null : `已售 ${formatNumber(sold)}`;
  });
  /**
   * 名稱拆成主標與副標：商品名稱慣用「文物名－商品型態」（例如「…方龕－複製品＆文物明信片套組」），
   * 主標只放文物名（最多兩行），型態放到下一行小字，列表才好掃讀。沒有分隔符號時整串都是主標。
   */
  protected nameParts = computed(() => {
    const full = this.name();
    const at = full.search(/[－—–]/);
    if (at <= 0 || at >= full.length - 1) return { main: full, sub: null as string | null };
    return { main: full.slice(0, at).trim(), sub: full.slice(at + 1).trim() };
  });

  /** 按下加入購物車：通知外部，並讓按鈕放大再還原一下 */
  protected onAddToCart(event: Event): void {
    this.addToCart.emit();
    bumpAddToCart(event.currentTarget as HTMLElement);
  }
}
