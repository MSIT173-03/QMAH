import { Component, input, output } from '@angular/core';
import { ModalDialog } from '../../shared/modal-dialog';

/**
 * 折價券兌換確認對話框：已登入的會員按下折價券的兌換區塊後顯示，列出折價券名稱與所需點數，
 * 由使用者確認或取消；本元件只負責顯示與回報選擇，實際呼叫兌換 API 由頁面處理。
 */
@Component({
  selector: 'app-coupon-redeem-dialog',
  imports: [ModalDialog],
  templateUrl: './coupon-redeem-dialog.html',
  styleUrl: './coupon-redeem-dialog.scss',
})
export class CouponRedeemDialog {
  /** 是否顯示對話框 */
  open = input(false);
  /** 要兌換的折價券名稱 */
  name = input('');
  /** 所需點數的顯示文字（例如「50 點」） */
  cost = input('');
  /** 兌換請求進行中：停用按鈕，避免重複送出 */
  pending = input(false);

  /** 按下「確認兌換」時觸發 */
  confirm = output<void>();
  /** 按下「取消」、Esc 或點擊背景時觸發 */
  cancel = output<void>();

  /** 以下為固定的版面文字 */
  protected readonly title = '確認兌換折價券';
  protected readonly nameLabel = '折價券';
  protected readonly costLabel = '價格';
  protected readonly note = '確認後會立即扣除點數，兌換後的折價券可在會員中心查看。';
  protected readonly confirmLabel = '確認兌換';
  protected readonly pendingLabel = '兌換中…';
  protected readonly cancelLabel = '取消';

  /** 兌換請求進行中不能取消，否則使用者看不到結果。 */
  protected onCancel(): void {
    if (!this.pending()) this.cancel.emit();
  }
}
