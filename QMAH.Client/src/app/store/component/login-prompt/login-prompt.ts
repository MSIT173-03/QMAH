import { Component, input, output } from '@angular/core';
import { ModalDialog } from '../../shared/modal-dialog';

/** 登入提示的預設說明文字（使用情境為加入購物車） */
export const DEFAULT_LOGIN_PROMPT_MESSAGE = '加入購物車需要先登入會員，是否前往登入頁？登入後會回到目前頁面。';

/**
 * 登入提示對話框：未登入的訪客使用會員功能（例如加入購物車）時顯示，
 * 由使用者決定前往登入頁或取消留在目前頁面；本元件只負責顯示與回報選擇，實際導覽由頁面處理。
 */
@Component({
  selector: 'app-login-prompt',
  imports: [ModalDialog],
  templateUrl: './login-prompt.html',
  styleUrl: './login-prompt.scss',
})
export class LoginPrompt {
  /** 是否顯示對話框 */
  open = input(false);
  /** 說明文字 */
  message = input(DEFAULT_LOGIN_PROMPT_MESSAGE);

  /** 按下「前往登入」時觸發 */
  confirm = output<void>();
  /** 按下「取消」、Esc 或點擊背景時觸發 */
  cancel = output<void>();

  /** 以下為固定的版面文字 */
  protected readonly title = '請先登入';
  protected readonly confirmLabel = '前往登入';
  protected readonly cancelLabel = '取消';
}
