import { Component, computed, input, output } from '@angular/core';
import { Panel, SectionHead, PillGroup, PillOption } from '../../../component';
import { ShippingOption } from '../../../api/api.models';
import { formatShippingFee } from '../../../shared/format';

/**
 * 結帳頁的配送與付款面板。
 * 運費金額由頁面依免運門檻換算後傳入，本元件只負責換算成顯示文字與選取樣式。
 */
@Component({
  selector: 'app-delivery-options',
  imports: [Panel, SectionHead, PillGroup],
  templateUrl: './delivery-options.html',
  styleUrls: [
    './delivery-options.scss',
  ],
})
export class DeliveryOptions {
  /** 可選的配送方式，fee 為本次訂單實際適用的運費 */
  shippings = input<ShippingOption[]>([]);
  /** 目前選取的配送方式索引 */
  selectedShipping = input(0);
  /** 可選的付款方式名稱 */
  payments = input<string[]>([]);
  /** 目前選取的付款方式索引 */
  selectedPayment = input(0);

  /** 選取配送方式時觸發，帶出該方式的索引 */
  shippingSelect = output<number>();
  /** 選取付款方式時觸發，帶出該方式的索引 */
  paymentSelect = output<number>();

  /** 配送方式按鈕資料：運費為 0 時顯示「免運」 */
  protected shippingButtons = computed(() =>
    this.shippings().map((option, i) => ({
      name: option.name,
      fee: formatShippingFee(option.fee),
      active: i === this.selectedShipping(),
    })),
  );

  /** 付款方式的藥丸按鈕選項 */
  protected paymentOptions = computed<PillOption[]>(() =>
    this.payments().map((label, i) => ({ label, active: i === this.selectedPayment() })),
  );

  /** 以下為固定的版面文字 */
  protected readonly title = '配送與付款';
  protected readonly tag = 'DELIVERY';
}
