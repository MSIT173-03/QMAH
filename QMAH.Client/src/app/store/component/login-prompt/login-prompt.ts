import { Component, ElementRef, effect, input, output, viewChild } from '@angular/core';

/**
 * 登入提示對話框：未登入的訪客使用會員功能（例如加入購物車）時顯示，
 * 由使用者決定前往登入頁或取消留在目前頁面；本元件只負責顯示與回報選擇，實際導覽由頁面處理。
 */
@Component({
  selector: 'app-login-prompt',
  templateUrl: './login-prompt.html',
  styleUrl: './login-prompt.scss',
})
export class LoginPrompt {
  /** 是否顯示對話框 */
  open = input(false);
  /** 說明文字 */
  message = input('加入購物車需要先登入會員，是否前往登入頁？登入後會回到目前頁面。');

  /** 按下「前往登入」時觸發 */
  confirm = output<void>();
  /** 按下「取消」、Esc 或點擊背景時觸發 */
  cancel = output<void>();

  /** 以下為固定的版面文字 */
  protected readonly title = '請先登入';
  protected readonly confirmLabel = '前往登入';
  protected readonly cancelLabel = '取消';

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    // 以原生 <dialog> 的 modal 模式呈現，焦點鎖定與 Esc 關閉由瀏覽器處理。
    effect(() => {
      const dialog = this.dialog().nativeElement;
      if (this.open() && !dialog.open) dialog.showModal();
      else if (!this.open() && dialog.open) dialog.close();
    });
  }

  /** Esc 會觸發 cancel 事件；阻止瀏覽器自行關閉，改由頁面更新 open 狀態，避免兩邊狀態不同步。 */
  protected onNativeCancel(event: Event): void {
    event.preventDefault();
    this.cancel.emit();
  }

  /** 點擊對話框外的背景（事件目標是 dialog 本身）視同取消。 */
  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.cancel.emit();
  }
}
