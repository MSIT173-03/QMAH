import { Component, computed, input, output } from '@angular/core';
import { Panel } from '../../../component/panel/panel';
import { SectionHead } from '../../../component/section-head/section-head';
import {
  CheckoutForm,
  CheckoutFormField,
  RECIPIENT_ADDR_FIELD,
  RECIPIENT_GRID_FIELDS,
  RECIPIENT_NOTE_FIELD,
} from '../checkout.data';

/**
 * 結帳頁的收件資訊面板。
 * 本元件僅負責顯示與回報欄位變更，表單內容由頁面持有；
 * 「帶入個人資料」只發出事件，實際填入的會員資料由頁面決定。
 */
@Component({
  selector: 'app-recipient-form',
  imports: [Panel, SectionHead],
  templateUrl: './recipient-form.html',
  styleUrls: [
    './recipient-form.scss',
  ],
})
export class RecipientForm {
  /** 目前的收件資訊表單內容 */
  form = input.required<CheckoutForm>();
  /** 是否已帶入會員個人資料，決定帶入按鈕的文字與配色 */
  filled = input(false);

  /** 使用者修改任一欄位時觸發，帶出欄位名稱與新內容 */
  fieldChange = output<{ field: CheckoutFormField; value: string }>();
  /** 按下「帶入個人資料」時觸發 */
  fill = output<void>();

  /** 帶入按鈕文字，由 filled 推導 */
  protected fillLabel = computed(() => (this.filled() ? '已帶入個人資料' : '帶入個人資料'));

  /** 以下為固定的版面文字與欄位定義 */
  protected readonly title = '收件資訊';
  protected readonly tag = 'RECIPIENT';
  protected readonly gridFields = RECIPIENT_GRID_FIELDS;
  protected readonly addrField = RECIPIENT_ADDR_FIELD;
  protected readonly noteField = RECIPIENT_NOTE_FIELD;

  /** 將輸入框的變更轉為 fieldChange 事件 */
  protected onInput(field: CheckoutFormField, event: Event): void {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    this.fieldChange.emit({ field, value: target.value });
  }
}
