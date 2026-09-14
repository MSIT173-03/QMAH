import { Component, computed, input, output, signal } from '@angular/core';
import { QtyStepper } from '../../../component/qty-stepper/qty-stepper';
import { ProductCard } from '../../../component/product-card/product-card';
import { SizeCondition } from '../size-condition/size-condition';

/**
 * 商品主視覺右側的商品資訊欄：品牌、名稱、評價摘要、價格、規格、尺寸狀態面板與購買操作。
 *
 * 繼承 app-product-card：商品本身的欄位（brand、name、price、was、rating、reviews、sold、dims）
 * 與其顯示字串（getPrice、getWas、getTag、getRating、getReviews、hasDeal）全部沿用商品卡片的定義，
 * 只有版面模板不同；購買數量與「直接購買」屬於商品頁自己的職責，因此另外定義於此。
 */
@Component({
  selector: 'app-product-summary',
  imports: [QtyStepper, SizeCondition],
  templateUrl: './product-summary.html',
  styleUrls: [
    './product-summary.scss',
  ],
})
export class ProductSummary extends ProductCard {
  /** 材質與工法說明 */
  material = input('');
  /** 紋樣／器型出處說明 */
  source = input('');
  /** 出貨說明（佔位資料，正式應由物流設定提供） */
  shipping = input('');
  /** 商品狀態說明 */
  condition = input('');
  /** 尺寸量測說明（佔位資料，正式應由商品說明設定提供） */
  sizeNote = input('');

  /** 以下為資訊欄的固定版面文字 */
  protected readonly materialLabel = '材質';
  protected readonly sourceLabel = '考據';
  protected readonly shippingLabel = '出貨';
  protected readonly soldSuffix = '已售';
  protected readonly buyNowLabel = '直接購買';

  /** 目前選購數量；只有本元件與其送出的事件會用到，因此不對外公開 */
  protected qty = signal(1);

  /** 已售件數顯示字串（千分位） */
  protected getSold = computed(() => this.sold()?.toLocaleString('en-US') ?? '');

  /** 加入購物車，帶出目前選購數量 */
  protected onAdd(): void {
    this.addToCart.emit(this.qty());
  }

  /** 直接購買，帶出目前選購數量 */
  protected onBuyNow(): void {
    this.buyNow.emit(this.qty());
  }

  /**
   * 加入購物車時觸發，帶出目前選購數量。
   * 商品頁需要知道選購數量，因此不沿用 app-product-card 的 onAddToCart（無參數）。
   */
  addToCart = output<number>();
  /** 直接購買時觸發，帶出目前選購數量 */
  buyNow = output<number>();
}
