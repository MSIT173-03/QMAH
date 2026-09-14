import { Component, computed, input, output } from '@angular/core';

/** 角標樣式變體 */
export type ProductCardBadgeVariant = 'ink' | 'teal';

/**
 * 商品卡片版面變體。
 * default：首頁格狀卡片；
 * list：商品列表頁格狀卡片（圖片佔位文字較深、評論數後綴較短、末行顯示尺寸規格）；
 * compact：僅顯示品牌／名稱／價格，用於購物車「再加購」等次要情境。
 */
export type ProductCardVariant = 'default' | 'list' | 'compact';

/**
 * 商品卡片。
 */
@Component({
  selector: 'app-product-card',
  imports: [],
  templateUrl: './product-card.html',
  styleUrls: [
    './product-card.scss',
  ],
})
export class ProductCard {
  id = input("")

  /** 版面變體 */
  variant = input<ProductCardVariant>('default');

  /** 商品頁連結網址 */
  href = computed(() => `store/product/${this.id()}`)
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
  /** 尺寸／規格說明；有值時取代已售數量，顯示於卡片最後一行 */
  dims = input<string | null>(null);

  /** 無圖片時顯示於圖片位置的佔位文字 */
  protected readonly slotLabel = '[ 商品圖 ]';
  /** 加入購物車按鈕文字 */
  protected readonly addCartLabel = '加入購物車';
  /** 無折扣商品的標籤文字 */
  protected readonly standardTagLabel = '定價商品';

  /** 是否為精簡版（僅顯示品牌／名稱／價格） */
  protected isCompact = computed(() => this.variant() === 'compact');
  /** 是否為商品列表頁版本 */
  protected isList = computed(() => this.variant() === 'list');
  /** 圖片佔位文字是否使用較深的顏色（首頁以外的版面皆較深） */
  protected isFaintSlot = computed(() => this.variant() !== 'default');

  /** 是否為折扣商品；有原價可比較即代表有折扣，價格顏色與標籤樣式皆以此判斷 */
  protected hasDeal = computed(() => this.was() !== null);

  /** 折扣後售價顯示字串（千分位），price 變動時即時換算 */
  protected getPrice = computed(() => this.price().toLocaleString('en-US'));
  /** 折扣前原價顯示字串（千分位），無折扣時為 null */
  protected getWas = computed(() => this.was()?.toLocaleString('en-US') ?? null);
  /** 折扣標籤文字，由售價與原價的差額換算折扣百分比 */
  protected getTag = computed(() => {
    const was = this.was();
    return was === null ? this.standardTagLabel : `-${Math.round((1 - this.price() / was) * 100)}%`;
  });
  /** 評分顯示字串，固定一位小數 */
  protected getRating = computed(() => this.rating().toFixed(1));
  /** 評論數顯示字串，列表頁使用較短的後綴 */
  protected getReviews = computed(
    () => `${this.reviews().toLocaleString('en-US')} 則評論`,
  );
  /** 商品已售數量 */
  protected getMeta = computed(() => {
    const sold = this.sold();
    return sold === null ? null : `${sold.toLocaleString('en-US')} 已售`;
  });

  /** 點擊加入購物車按鈕時觸發 */
  onAddToCart = output<void>();
}
