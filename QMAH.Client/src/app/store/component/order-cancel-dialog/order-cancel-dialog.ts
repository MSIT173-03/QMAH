import { Component, input, output } from '@angular/core';
import { ModalDialog } from '../../shared/modal-dialog';

/**
 * 取消訂單確認對話框：列出訂單編號與應付金額，由使用者確認或返回；
 * 本元件只負責顯示與回報選擇，實際呼叫取消 API 由頁面處理。
 */
@Component({
  selector: 'app-order-cancel-dialog',
  imports: [ModalDialog],
  templateUrl: './order-cancel-dialog.html',
  styleUrl: './order-cancel-dialog.scss',
})
export class OrderCancelDialog {
  /** 是否顯示對話框 */
  open = input(false);
  /** 訂單編號 */
  orderNo = input('');
  /** 應付金額的顯示文字 */
  payable = input('');
  /** 取消請求進行中：停用按鈕，避免重複送出 */
  pending = input(false);

  /** 按下「確認取消」時觸發 */
  confirm = output<void>();
  /** 按下「返回」、Esc 或點擊背景時觸發 */
  cancel = output<void>();

  /** 以下為固定的版面文字 */
  protected readonly title = '確認取消訂單';
  protected readonly orderNoLabel = '訂單';
  protected readonly payableLabel = '金額';
  protected readonly note = '取消後會歸還庫存、折價券與點數；購物車不會還原，需要時請重新加入商品。若已在綠界完成付款，請不要取消。';
  protected readonly confirmLabel = '確認取消';
  protected readonly pendingLabel = '取消中…';
  protected readonly cancelLabel = '返回';

  /** 取消請求進行中不能關閉，否則使用者看不到結果。 */
  protected onCancel(): void {
    if (!this.pending()) this.cancel.emit();
  }
}
