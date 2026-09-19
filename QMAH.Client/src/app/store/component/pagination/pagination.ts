import { Component, computed, input, output } from '@angular/core';

/**
 * 分頁切換元件：顯示目前頁碼／總頁數，並提供上一頁／下一頁按鈕。
 * 只負責呈現與觸發事件，實際頁碼狀態（含網址查詢字串同步）由外部頁面管理。
 */
@Component({
  selector: 'app-pagination',
  imports: [],
  templateUrl: './pagination.html',
  styleUrls: [
    './pagination.scss',
  ],
})
export class Pagination {
  /** 目前頁碼，從 1 開始 */
  page = input(1);
  /** 總頁數，至少為 1 */
  totalPages = input(1);

  /** 點擊上一頁／下一頁時觸發，帶出目標頁碼 */
  pick = output<number>();

  /** 上一頁／下一頁按鈕文字 */
  protected readonly prevLabel = '← 上一頁';
  protected readonly nextLabel = '下一頁 →';

  /** 是否可回到上一頁 */
  protected hasPrev = computed(() => this.page() > 1);
  /** 是否可前往下一頁 */
  protected hasNext = computed(() => this.page() < this.totalPages());
}
