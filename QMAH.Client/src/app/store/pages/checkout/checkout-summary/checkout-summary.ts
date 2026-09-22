import { Component, computed, input, output } from '@angular/core';
import { Panel } from '../../../component';
import { OrderQuote } from '../../../api/api.models';
import { formatCut, formatMoney, formatNumber, formatShippingFee } from '../../../shared/format';
import { CART_PATH } from '../../../shared/paths';
import { StoreLink } from '../../../shared/store-link';

/**
 * 結帳頁側欄的訂單金額摘要。
 * 商品行小計、各項折抵、運費、應付總額與回饋點數皆來自後端的訂單試算結果，本元件只負責格式化顯示。
 */
@Component({
  selector: 'app-checkout-summary',
  imports: [Panel, StoreLink],
  templateUrl: './checkout-summary.html',
  styleUrls: [
    './checkout-summary.scss',
  ],
})
export class CheckoutSummary {
  /** 後端的訂單試算結果；尚未取得時為 null */
  quote = input<OrderQuote | null>(null);
  /** 選用的配送方式名稱 */
  shipName = input('');
  /** 正式配送／付款選項是否已啟用；契約未完成時禁止送出。 */
  checkoutEnabled = input(false);
  /** 是否已按下確認下單 */
  submitted = input(false);
  /** 收件資訊必填欄位是否皆已填妥 */
  valid = input(false);
  /** 訂單是否已成立（送出訂單的 API 已回應） */
  placed = input(false);

  /** 按下確認下單時觸發 */
  submitOrder = output<void>();

  /** 各商品行的顯示資料 */
  protected lineRows = computed(() =>
    (this.quote()?.lines ?? []).map((line) => ({
      id: line.productId,
      name: line.name,
      qty: line.qty,
      total: formatMoney(line.lineTotal),
    })),
  );

  /** 商品小計顯示文字 */
  protected subtotalLabel = computed(() => formatMoney(this.quote()?.subtotal ?? 0));
  /** 商品折扣顯示文字，有折扣時以負號呈現 */
  protected itemDiscountLabel = computed(() => formatCut(this.quote()?.itemDiscount ?? 0));
  /** 折價券折抵顯示文字 */
  protected couponCutLabel = computed(() => formatCut(this.quote()?.couponDiscount ?? 0));
  /** 點數折抵顯示文字 */
  protected pointCutLabel = computed(() => formatCut(this.quote()?.pointsUsed ?? 0));
  /** 運費列標題，附上選用的配送方式 */
  protected shipRowLabel = computed(() => `${this.shippingLabel} · ${this.shipName()}`);
  /** 運費顯示文字 */
  protected shipFeeLabel = computed(() => formatShippingFee(this.quote()?.shippingFee ?? 0));
  /** 應付總額顯示文字 */
  protected totalLabel = computed(() => formatMoney(this.quote()?.payable ?? 0));
  /** 回饋點數顯示文字 */
  protected earnLabel = computed(() => formatNumber(this.quote()?.pointsEarned ?? 0));

  /** 訂單成立或結帳能力停用時，按鈕文字要直接反映真實狀態。 */
  protected submitLabel = computed(() => {
    if (this.placed()) return '訂單已送出';
    return this.checkoutEnabled() ? '確認下單' : '結帳目前未啟用';
  });
  /** 使用原生 disabled，讓滑鼠、鍵盤與輔助工具都不會把停用的下單當成可操作。 */
  protected submitDisabled = computed(() => !this.checkoutEnabled() || this.placed());
  /** 已送出但必填欄位未填妥時，顯示補填提示 */
  protected showMissing = computed(() => this.submitted() && !this.valid());

  /** 以下為固定的版面文字與連結 */
  protected readonly summaryTag = 'ORDER SUMMARY';
  protected readonly subtotalRowLabel = '商品小計';
  protected readonly itemDiscountRowLabel = '商品折扣';
  protected readonly couponRowLabel = '折價券';
  protected readonly pointRowLabel = '點數折抵';
  protected readonly totalRowLabel = '應付總額';
  protected readonly missingNote = '請先填寫收件人姓名、電話與地址。';
  protected readonly backLabel = '返回購物車';
  protected readonly backHref = CART_PATH;
  private readonly shippingLabel = '運費';
}
