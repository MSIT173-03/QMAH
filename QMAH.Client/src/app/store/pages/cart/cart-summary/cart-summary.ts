import { Component, computed, input } from '@angular/core';
import { Panel } from '../../../component';
import { CartAmounts } from '../../../api/api.models';
import { formatCut, formatMoney, formatShippingFee } from '../../../shared/format';
import { CHECKOUT_PATH } from '../../../shared/paths';
import { StoreLink } from '../../../shared/store-link';

/**
 * 購物車側欄的訂單金額摘要。
 * 所有金額（小計、折扣、運費、免運差額與應付總額）皆由後端計算後傳入，本元件只負責格式化顯示。
 */
@Component({
  selector: 'app-cart-summary',
  imports: [Panel, StoreLink],
  templateUrl: './cart-summary.html',
  styleUrl: './cart-summary.scss',
})
export class CartSummary {
  /** 購物車金額摘要；尚未載入時為 null */
  amounts = input<CartAmounts | null>(null);

  /** 商品小計顯示文字 */
  protected getSubtotal = computed(() => formatMoney(this.amounts()?.subtotal ?? 0));
  /** 折扣金額顯示文字，有折扣時以負號呈現 */
  protected getSavings = computed(() => formatCut(this.amounts()?.itemDiscount ?? 0));
  /** 運費顯示文字；尚無配送規則時顯示「結帳時計算」，不以 0 假裝免運 */
  protected getShipping = computed(() => {
    const fee = this.amounts()?.shippingFee ?? null;
    return fee === null ? '結帳時計算' : formatShippingFee(fee);
  });
  /** 運費說明文字：已達門檻顯示達成訊息，否則提示還差多少金額；尚無免運門檻時不顯示 */
  protected getShipNote = computed(() => {
    const threshold = this.amounts()?.freeShippingThreshold ?? null;
    const shortfall = this.amounts()?.freeShippingShortfall ?? null;
    if (threshold === null || shortfall === null) return '';
    return shortfall === 0
      ? `已符合滿 ${formatMoney(threshold)} 免運。`
      : `再加購 ${formatMoney(shortfall)} 即可享免運。`;
  });
  /** 應付總額顯示文字 */
  protected getTotal = computed(() => formatMoney(this.amounts()?.payable ?? 0));

  /** 以下為面板的固定版面文字 */
  protected readonly summaryLabel = 'ORDER SUMMARY';
  protected readonly subtotalLabel = '商品小計';
  protected readonly savingsLabel = '折扣';
  protected readonly shippingLabel = '運費';
  protected readonly totalLabel = '應付總額';
  // integration: 正式配送／付款 options 尚未存在；先保留原入口位置但停用操作，避免導向不可完成的下單流程。
  protected readonly checkoutLabel = '結帳目前未啟用';
  protected readonly checkoutEnabled = false;
  protected readonly checkoutHref = CHECKOUT_PATH;
  protected readonly serviceLabel = 'SERVICE';
  protected readonly serviceNote =
    '每件商品附授權與考據說明卡；瓷器與琺瑯器採雙層防撞包裝，30 天內可退換。';
}
