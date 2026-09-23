import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { QmahIconComponent } from '../../../shared/components/qmah-icon/qmah-icon';
import { formatNumber } from '../../shared/format';
import { toDisplayImage } from '../../shared/image-utils';
import { productPath } from '../../shared/paths';
import { formatRating, formatReviews, toPriceView } from '../../shared/product-view';
import { StoreLink } from '../../shared/store-link';

/** 角標樣式變體 */
export type ProductCardBadgeVariant = 'ink' | 'teal';

/**
 * 商品卡片版面變體。
 * default：首頁格狀卡片；
 * list：商品列表頁格狀卡片（圖片佔位文字較深）；
 * compact：僅顯示品牌／名稱／價格，用於購物車「再加購」等次要情境。
 */
export type ProductCardVariant = 'default' | 'list' | 'compact';

/**
 * 商品卡片。
 */
@Component({
  selector: 'app-product-card',
  imports: [StoreLink, QmahIconComponent],
  templateUrl: './product-card.html',
  styleUrls: [
    './product-card.scss',
  ],
})
export class ProductCard {
  id = input('');

  /** 版面變體 */
  variant = input<ProductCardVariant>('default');

  /** 商品圖片網址；錯誤時會先嘗試同目錄的 display 圖，再顯示明確的影像待補狀態。 */
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
  /** 已加入購物車：按鈕維持反白並在右下角顯示打勾（購物車頁「再加購」使用） */
  added = input(false);

  /** 無圖片時顯示的中性狀態，不假裝這是另一件文物。 */
  protected readonly slotLabel = '影像待補';
  /** 加入購物車按鈕文字 */
  protected readonly addCartLabel = '加入購物車';

  /** 目前實際嘗試中的圖片網址；輸入更換時由 linkedSignal 重設。 */
  protected imageSrc = linkedSignal(() => this.coverImage());
  protected showPlaceholder = computed(() => !this.imageSrc());
  /** 圖片讀取失敗時先 fallback 到同一件文物 display 圖，避免誤顯示其他商品。 */
  protected onImageError(): void {
    const current = this.imageSrc();
    const display = toDisplayImage(current);
    if (display && display !== current) {
      this.imageSrc.set(display);
      return;
    }
    this.imageSrc.set(null);
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
