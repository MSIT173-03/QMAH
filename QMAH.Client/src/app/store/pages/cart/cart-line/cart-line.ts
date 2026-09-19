import { Component, computed, input, output } from '@angular/core';
import { QtyStepper } from '../../../component';
import { formatMoney } from '../../../shared/format';
import { productPath } from '../../../shared/paths';
import { toPriceView } from '../../../shared/product-view';
import { StoreLink } from '../../../shared/store-link';

/**
 * 購物車單一行項目：縮圖、商品資訊、數量調整、行小計與移除。
 * 價格列的顯示字串與 app-product-card 共用 shared/product-view 的換算函式；行小計由後端計算後傳入。
 */
@Component({
  selector: 'app-cart-line',
  imports: [QtyStepper, StoreLink],
  templateUrl: './cart-line.html',
  styleUrls: [
    './cart-line.scss',
  ],
})
export class CartLine {
  id = input('');
  /** 品牌名稱 */
  brand = input('');
  /** 器類名稱，與品牌併排顯示於第一行 */
  cat = input('');
  /** 商品名稱 */
  name = input('');
  /** 折扣後單價 */
  price = input(0);
  /** 折扣前原價，為 null 時代表無折扣 */
  was = input<number | null>(null);
  /** 目前數量 */
  qty = input(1);
  /** 此行小計（後端計算） */
  lineTotal = input(0);
  /** 是否正在執行移除動畫（淡出並收合列高） */
  leaving = input(false);

  /** 數量變更時觸發；數量為 0 代表使用者將其減至 0（視同移除） */
  qtyChange = output<number>();
  /** 點擊移除按鈕時觸發 */
  remove = output<void>();

  /** 無圖片時顯示於縮圖位置的佔位文字 */
  protected readonly slotLabel = '[ 商品圖 ]';
  /** 移除按鈕文字 */
  protected readonly removeLabel = '移除';

  /** 商品頁連結網址 */
  protected link = computed(() => productPath(this.id()));
  /** 品牌與器類以「 · 」串接的說明文字，略過無值的項目 */
  protected meta = computed(() => [this.brand(), this.cat()].filter(Boolean).join(' · '));
  /** 價格列顯示字串 */
  protected priceView = computed(() => toPriceView(this.price(), this.was()));
  /** 此行小計顯示字串 */
  protected lineTotalText = computed(() => formatMoney(this.lineTotal()));
}
