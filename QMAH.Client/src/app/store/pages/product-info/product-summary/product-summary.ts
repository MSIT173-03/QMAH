import { Component, computed, input, output, signal } from '@angular/core';
import { QtyStepper } from '../../../component';
import { formatNumber } from '../../../shared/format';
import { formatRating, formatReviews, toPriceView } from '../../../shared/product-view';
import { SizeCondition } from '../size-condition/size-condition';

/**
 * 商品主視覺右側的商品資訊欄：品牌、名稱、評價摘要、價格、規格、尺寸狀態面板與購買操作。
 * 價格列與評分的顯示字串與 app-product-card 共用 shared/product-view 的換算函式。
 */
@Component({
  selector: 'app-product-summary',
  imports: [QtyStepper, SizeCondition],
  templateUrl: './product-summary.html',
  styleUrls: [
    './product-summary.scss',
  ],
})
export class ProductSummary {
  /** 品牌名稱 */
  brand = input('');
  /** 商品名稱 */
  name = input('');
  /** 評分 */
  rating = input(0);
  /** 評論數 */
  reviews = input(0);
  /** 已售數量 */
  sold = input(0);
  /** 折扣後售價 */
  price = input(0);
  /** 折扣前原價，為 null 時代表無折扣 */
  was = input<number | null>(null);
  /** 材質與工法說明 */
  material = input('');
  /** 紋樣／器型出處說明 */
  source = input('');
  /** 出貨說明（佔位資料，正式應由物流設定提供） */
  shipping = input('');
  /** 尺寸／規格說明 */
  dims = input('');
  /** 關聯文物原始尺寸；與固定 A6 成品尺寸分開顯示。 */
  artifactDims = input('');
  /** 商品狀態說明 */
  condition = input('');
  /** 尺寸量測說明（佔位資料，正式應由商品說明設定提供） */
  sizeNote = input('');

  /** 加入購物車時觸發，帶出目前選購數量 */
  addToCart = output<number>();
  /** 直接購買時觸發，帶出目前選購數量；目前會先放入購物車再進入購物車頁。 */
  buyNow = output<number>();

  /** 以下為資訊欄的固定版面文字 */
  protected readonly materialLabel = '材質';
  protected readonly sourceLabel = '考據';
  protected readonly shippingLabel = '出貨';
  protected readonly soldSuffix = '已售';
  protected readonly addCartLabel = '加入購物車';
  protected readonly buyNowLabel = '加入並查看購物車';

  /** 目前選購數量；只有本元件與其送出的事件會用到，因此不對外公開 */
  protected qty = signal(1);

  /** 價格列顯示字串 */
  protected priceView = computed(() => toPriceView(this.price(), this.was()));
  /** 評分顯示字串 */
  protected ratingText = computed(() => formatRating(this.rating()));
  /** 評論數顯示字串 */
  protected reviewsText = computed(() => formatReviews(this.reviews()));
  /** 是否有評論；沒有評論時不顯示「0.0」「0 則評論」，改顯示提示文字 */
  protected hasReviews = computed(() => this.reviews() > 0);
  /** 尚無評論時的提示文字 */
  protected readonly noReviewsLabel = '無評論';
  /** 已售件數顯示字串（千分位） */
  protected soldText = computed(() => formatNumber(this.sold()));

  /** 加入購物車，帶出目前選購數量 */
  protected onAdd(): void {
    this.addToCart.emit(this.qty());
  }

  /** 直接購買，帶出目前選購數量 */
  protected onBuyNow(): void {
    this.buyNow.emit(this.qty());
  }
}
