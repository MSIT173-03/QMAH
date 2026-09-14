import { Component, computed, input, output } from '@angular/core';
import { Panel } from '../../../component/panel/panel';
import { formatMoney } from '../../../shared/format';
import { CheckoutLineData, sumPayable, sumSubtotal } from '../checkout.data';
import { CART_PATH } from '../../../shared/paths';

/**
 * 結帳頁側欄的訂單金額摘要。
 * 外部只傳入訂單商品行與各項折抵／運費金額，商品小計、商品折扣、應付總額、
 * 回饋點數與按鈕文字皆由本元件推導，顯示用的金額字串也一併在此格式化。
 */
@Component({
  selector: 'app-checkout-summary',
  imports: [Panel],
  templateUrl: './checkout-summary.html',
  styleUrls: [
    './checkout-summary.scss',
  ],
})
export class CheckoutSummary {
  /** 訂單商品行（含折扣前後單價，商品小計與折扣由此推導） */
  lines = input<CheckoutLineData[]>([]);
  /** 折價券折抵金額 */
  couponCut = input(0);
  /** 點數折抵金額 */
  pointCut = input(0);
  /** 選用的配送方式名稱 */
  shipName = input('');
  /** 本次訂單實際運費 */
  shipFee = input(0);
  /** 是否已按下確認下單 */
  submitted = input(false);
  /** 收件資訊必填欄位是否皆已填妥 */
  valid = input(false);
  /** 訂單是否已成立（送出訂單的 API 已回應） */
  placed = input(false);
  /** 訂單完成後回饋的點數比例（以應付總額計算） */
  earnRate = input(0);

  /** 按下確認下單時觸發 */
  submitOrder = output<void>();

  /** 商品小計（折扣前） */
  private subtotal = computed(() => sumSubtotal(this.lines()));
  /** 應付商品金額（折扣後） */
  private payable = computed(() => sumPayable(this.lines()));
  /** 應付總額：應付商品金額扣除各項折抵後加上運費，不低於 0 */
  private total = computed(() =>
    Math.max(0, this.payable() - this.couponCut() - this.pointCut() + this.shipFee()),
  );

  /** 各商品行的顯示資料，單行金額由單價與數量推導 */
  protected lineRows = computed(() =>
    this.lines().map((line) => ({
      id: line.id,
      name: line.name,
      qty: line.qty,
      total: formatMoney(line.price * line.qty),
    })),
  );

  /** 商品小計顯示文字 */
  protected subtotalLabel = computed(() => formatMoney(this.subtotal()));
  /** 商品折扣顯示文字，有折扣時以負號呈現 */
  protected itemDiscountLabel = computed(() => this.cutLabel(this.subtotal() - this.payable()));
  /** 折價券折抵顯示文字 */
  protected couponCutLabel = computed(() => this.cutLabel(this.couponCut()));
  /** 點數折抵顯示文字 */
  protected pointCutLabel = computed(() => this.cutLabel(this.pointCut()));
  /** 運費列標題，附上選用的配送方式 */
  protected shipRowLabel = computed(() => `${this.shippingLabel} · ${this.shipName()}`);
  /** 運費顯示文字 */
  protected shipFeeLabel = computed(() => (this.shipFee() === 0 ? '免運' : formatMoney(this.shipFee())));
  /** 應付總額顯示文字 */
  protected totalLabel = computed(() => formatMoney(this.total()));
  /** 回饋點數顯示文字，依應付總額換算 */
  protected earnLabel = computed(() => Math.round(this.total() * this.earnRate()).toLocaleString('en-US'));

  /** 訂單成立後，按鈕轉為完成狀態文字 */
  protected submitLabel = computed(() => (this.placed() ? '訂單已送出' : '確認下單'));
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

  /** 折抵金額顯示文字：大於 0 時以負號呈現，否則顯示 $0 */
  private cutLabel(amount: number): string {
    return amount > 0 ? '−' + formatMoney(amount) : formatMoney(0);
  }
}
