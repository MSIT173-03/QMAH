import { Component, computed, input, output } from '@angular/core';
import { QtyStepper } from '../../../component/qty-stepper/qty-stepper';
import { ProductCard } from '../../../component/product-card/product-card';

/**
 * 購物車單一行項目。
 *
 * 繼承 app-product-card：商品本身的欄位（href、brand、name、price、was、dims…）與其顯示字串
 * （getPrice、getWas、getTag、hasDeal）全部沿用商品卡片的定義，只有版面模板不同；
 * 數量調整、行小計與移除屬於購物車自己的職責，因此另外定義於此，
 * 元件也留在 page/cart/ 之下而非共用元件資料夾。
 */
@Component({
  selector: 'app-cart-line',
  imports: [QtyStepper],
  templateUrl: './cart-line.html',
  styleUrls: [
    './cart-line.scss',
  ],
})
export class CartLine extends ProductCard {
  /** 器類名稱，與品牌併排顯示於第一行 */
  cat = input('');
  /** 目前數量 */
  qty = input(1);
  /** 是否正在執行移除動畫（淡出並收合列高） */
  leaving = input(false);

  /** 無圖片時顯示於縮圖位置的佔位文字 */
  protected readonly thumbSlot = '[ 商品圖 ]';
  /** 移除按鈕文字 */
  protected readonly removeLabel = '移除';

  /** 此行小計顯示字串（千分位），由單價與數量相乘換算 */
  protected getLineTotal = computed(() => (this.price() * this.qty()).toLocaleString('en-US'));

  /** 數量變更時觸發；數量為 0 代表使用者將其減至 0（視同移除） */
  qtyChange = output<number>();
  /** 點擊移除按鈕時觸發 */
  remove = output<void>();
}
