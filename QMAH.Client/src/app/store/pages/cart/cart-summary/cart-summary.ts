import { Component, computed, input } from '@angular/core';
import { Panel } from '../../../component/panel/panel';
import { formatMoney } from '../../../shared/format';
import { CHECKOUT_PATH } from '../../../shared/paths';

/**
 * 購物車側欄的訂單金額摘要。
 * 外部傳入折扣前與折扣後的商品金額，以及運費規則（免運門檻與運費）；
 * 折扣額、實際運費、免運提示與應付總額皆由本元件推導，顯示用的金額字串也一併在此格式化。
 */
@Component({
  selector: 'app-cart-summary',
  imports: [Panel],
  templateUrl: './cart-summary.html',
  styleUrls: [
    './cart-summary.scss',
  ],
})
export class CartSummary {
  /** 商品小計（未折扣前金額加總） */
  subtotal = input(0);
  /** 應付商品金額（折扣後金額加總），免運判斷與總額皆以此為準 */
  payable = input(0);
  /** 滿額免運門檻 */
  freeShippingThreshold = input(0);
  /** 未達免運門檻時的運費 */
  shippingFee = input(0);

  /** 是否已達免運門檻（購物車為空時視同已達成，不顯示運費） */
  private freeShip = computed(() => this.payable() === 0 || this.payable() >= this.freeShippingThreshold());
  /** 本次實際運費 */
  private appliedFee = computed(() => (this.freeShip() ? 0 : this.shippingFee()));

  /** 商品小計顯示文字 */
  protected getSubtotal = computed(() => formatMoney(this.subtotal()));
  /** 折扣金額顯示文字，有折扣時以負號呈現 */
  protected getSavings = computed(() => {
    const diff = this.subtotal() - this.payable();
    return diff > 0 ? '−' + formatMoney(diff) : formatMoney(0);
  });
  /** 運費顯示文字 */
  protected getShipping = computed(() => (this.appliedFee() === 0 ? '免運' : formatMoney(this.appliedFee())));
  /** 運費說明文字：已達門檻顯示達成訊息，否則提示還差多少金額 */
  protected getShipNote = computed(() =>
    this.freeShip()
      ? `已符合滿 ${formatMoney(this.freeShippingThreshold())} 免運。`
      : `再加購 ${formatMoney(this.freeShippingThreshold() - this.payable())} 即可享免運。`,
  );
  /** 應付總額顯示文字 */
  protected getTotal = computed(() => formatMoney(this.payable() + this.appliedFee()));

  /** 以下為面板的固定版面文字 */
  protected readonly summaryLabel = 'ORDER SUMMARY';
  protected readonly subtotalLabel = '商品小計';
  protected readonly savingsLabel = '折扣';
  protected readonly shippingLabel = '運費';
  protected readonly totalLabel = '應付總額';
  protected readonly checkoutLabel = '前往結帳';
  protected readonly checkoutHref = CHECKOUT_PATH;
  protected readonly serviceLabel = 'SERVICE';
  protected readonly serviceNote =
    '每件商品附授權與考據說明卡；瓷器與琺瑯器採雙層防撞包裝，30 天內可退換。';
}
