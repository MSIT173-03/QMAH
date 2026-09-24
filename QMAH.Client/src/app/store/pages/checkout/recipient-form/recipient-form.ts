import { Component, computed, input, output } from '@angular/core';
import { Recipient } from '../../../api/api.models';
import { Panel, SectionHead } from '../../../component';
import {
  RECIPIENT_ADDR_FIELD,
  RECIPIENT_GRID_FIELDS,
  RECIPIENT_NOTE_FIELD,
  RECIPIENT_REGION_FIELDS,
  RecipientField,
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
  form = input.required<Recipient>();
  /** 是否已帶入會員個人資料，決定帶入按鈕的文字與配色 */
  filled = input(false);

  /** 使用者修改任一欄位時觸發，帶出欄位名稱與新內容 */
  fieldChange = output<{ field: RecipientField; value: string }>();
  /** 按下「帶入個人資料」時觸發 */
  fill = output<void>();

  /** 帶入按鈕文字，由 filled 推導 */
  protected fillLabel = computed(() => (this.filled() ? '已帶入個人資料' : '帶入個人資料'));

  /** 以下為固定的版面文字與欄位定義 */
  protected readonly title = '收件資訊';
  protected readonly tag = 'RECIPIENT';
  /** 以格狀排列的短欄位，每組各佔一個格狀區塊；行政區欄位在後端訂單分欄保存，獨立成一組 */
  protected readonly gridGroups = [RECIPIENT_GRID_FIELDS, RECIPIENT_REGION_FIELDS];
  protected readonly addrField = RECIPIENT_ADDR_FIELD;
  protected readonly noteField = RECIPIENT_NOTE_FIELD;

  /** 將輸入框的變更轉為 fieldChange 事件 */
  protected onInput(field: RecipientField, event: Event): void {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    this.fieldChange.emit({ field, value: target.value });
  }
}
