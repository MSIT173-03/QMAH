import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { formatMoney } from '../../shared/format';
import { ModalDialog } from '../../shared/modal-dialog';
import { EcpayCheckoutForm } from '../../api/api.models';
import { submitEcpayForm } from '../../shared/ecpay-form';

/**
 * 訂單送出成功的提示對話框：結帳頁確認下單後顯示，唯一的出路是回到商品列表，
 * 不提供「取消」——訂單已經成立，沒有東西可以取消。
 */
@Component({
  selector: 'app-order-placed-dialog',
  imports: [ModalDialog],
  templateUrl: './order-placed-dialog.html',
  styleUrl: './order-placed-dialog.scss',
})
export class OrderPlacedDialog {
  /** 是否顯示對話框 */
  open = input(false);
  /** 訂單編號 */
  orderNo = input('');
  /** 應付總額 */
  payable = input(0);
  /** 信用卡付款才有值；有值時多顯示一顆前往綠界測試付款頁的按鈕 */
  ecpayCheckout = input<EcpayCheckoutForm | null>(null);

  /** 按下「回到商品列表」、背景點擊或 Esc 時觸發；訂單已成立，這裡只有一個出路 */
  confirm = output<void>();

  /** 以下為固定的版面文字 */
  protected readonly title = '訂單已送出';
  protected readonly confirmLabel = '回到商品列表';
  protected readonly ecpayLabel = '前往綠界測試付款頁 →';

  /** 應付總額顯示文字 */
  protected payableLabel = computed(() => formatMoney(this.payable()));

  private readonly document = inject(DOCUMENT);

  /**
   * 在新分頁開啟綠界測試付款頁。表單在點擊事件裡同步送出，避免新分頁被瀏覽器當成快顯視窗擋掉。
   * 這份表單是下單時後端已記錄的付款嘗試；之後要重新付款請到我的訂單頁取得新表單。
   */
  protected onEcpayCheckout(): void {
    const checkoutForm = this.ecpayCheckout();
    if (!checkoutForm) return;
    submitEcpayForm(this.document, checkoutForm, '_blank');
  }
}
