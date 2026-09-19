import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { formatNumber } from '../../shared/format';
import { productPath } from '../../shared/paths';
import { formatRating, formatReviews, toPriceView } from '../../shared/product-view';
import { StoreLink } from '../../shared/store-link';

/** 角標樣式變體 */
export type ProductCardBadgeVariant = 'ink' | 'teal';

/**
 * 商品卡片版面變體。
 * default：首頁格狀卡片；
 * grid：商品列表頁格狀卡片（圖片佔位文字較深）；
 * compact：僅顯示品牌／名稱／價格，用於購物車「再加購」等次要情境。
 */
export type ProductCardVariant = 'default' | 'grid' | 'compact';

/**
 * 商品卡片。
 */
@Component({
  selector: 'app-product-card',
  imports: [StoreLink],
  templateUrl: './product-card.html',
  styleUrls: [
    './product-card.scss',
  ],
})
export class ProductCard {
  id = input('');

  /** 版面變體 */
  variant = input<ProductCardVariant>('default');

  /** 商品圖片網址，為 null 時改顯示佔位符（slotLabel） */
  coverImage = input<string | null>(null);

  /** 角標文字（例如「#01」「新品」），為 null 時不顯示 */
  badge = input<string | null>(null);
  /** 角標樣式變體 */
  badgeVariant = input<ProductCardBadgeVariant>('ink');

  /** 品牌名稱，為 null 時不顯示 */
  brand = input<string | null>(null);
  /** 商品名稱 */
  name = input('');

  /** 折扣後售價 */
  price = input(0);
  /** 折扣前原價，為 null 時代表無折扣（不顯示劃線價，標籤改為定價商品） */
  was = input<number | null>(null);

  /** 評分 */
  rating = input(0);
  /** 評論數 */
  reviews = input(0);
  /** 已售數量，為 null 時卡片最後一行不顯示已售資訊 */
  sold = input<number | null>(null);

  /** 點擊加入購物車按鈕時觸發 */
  addToCart = output<void>();

  /** 無圖片時顯示於圖片位置的佔位文字 */
  protected readonly slotLabel = '[ 商品圖 ]';
  /** 加入購物車按鈕文字 */
  protected readonly addCartLabel = '加入購物車';

  /**
   * 是否顯示佔位符：無 coverImage 時即為 true；coverImage 變動時重新從此推導，
   * 但圖片讀取失敗（onImageError）可覆寫為 true，退回佔位符樣式。
   */
  protected showPlaceholder = linkedSignal(() => !this.coverImage());
  /** 圖片讀取失敗時觸發，退回無圖片的預設樣式 */
  protected onImageError(): void {
    this.showPlaceholder.set(true);
  }

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
  /** 已售數量顯示字串，未提供時為 null */
  protected soldText = computed(() => {
    const sold = this.sold();
    return sold === null ? null : `${formatNumber(sold)} 已售`;
  });
}
