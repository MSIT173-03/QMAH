import { Component, computed, input, model, output, signal } from '@angular/core';

import { PRODUCT_LIST_PATH } from "../../shared/paths"

export interface SearchHotLink {
  label: string;
  href: string;
}

export interface SearchSuggestion {
  name: string;
  count: string;
}

/**
 * 搜尋框元件：提供關鍵字輸入與送出搜尋，聚焦且有輸入內容時可顯示熱門搜尋連結與即時建議下拉清單；
 * compact 模式（商品列表頁使用）僅保留輸入與送出功能，不顯示熱門搜尋與建議下拉。
 */
@Component({
  selector: 'app-search-bar',
  imports: [],
  templateUrl: './search-bar.html',
  styleUrls: [
    './search-bar.scss',
  ],
})
export class SearchBar {
  /** 輸入框提示文字 */
  placeholder = input('搜尋文物周邊、紋樣');
  /** 精簡版：用於商品列表頁，隱藏熱門搜尋與建議下拉 */
  compact = input(false);

  /** 熱門搜尋區塊前綴標籤文字，全站一致 */
  protected readonly hotLabel = 'HOT';

  /** 熱門搜尋連結清單 */
  hotLinks = input<SearchHotLink[]>([]);
  /** 建議下拉清單資料 */
  suggestions = input<SearchSuggestion[]>([]);
  protected readonly productListPath = PRODUCT_LIST_PATH

  /** 搜尋框目前輸入值（雙向綁定） */
  value = model('');
  /** 送出搜尋（按 Enter 或點擊搜尋按鈕）時觸發，帶出去除頭尾空白的關鍵字 */
  search = output<string>();
  /** 點擊某個建議項目時觸發 */
  suggestionPick = output<SearchSuggestion>();

  /** 輸入框目前是否處於聚焦狀態 */
  protected focused = signal(false);
  /** 是否顯示建議下拉：非精簡版、輸入框聚焦中、有輸入內容且有建議資料時才顯示 */
  protected showSuggest = computed(
    () => !this.compact() && this.focused() && this.value().trim().length > 0 && this.suggestions().length > 0,
  );

  /** 延遲隱藏建議下拉用的計時器，避免點擊建議項目前先觸發 blur 收合 */
  private blurTimer?: ReturnType<typeof setTimeout>;

  /** 同步輸入框內容到 value */
  protected onInput(event: Event) {
    this.value.set((event.target as HTMLInputElement).value);
  }

  /** 聚焦時取消尚未執行的收合計時器 */
  protected onFocus() {
    clearTimeout(this.blurTimer);
    this.focused.set(true);
  }

  /** 失焦後延遲收合建議下拉，讓點擊建議項目的事件能先觸發 */
  protected onBlur() {
    this.blurTimer = setTimeout(() => this.focused.set(false), 140);
  }

  /** 送出搜尋關鍵字 */
  protected submit() {
    this.search.emit(this.value().trim());
  }

  /** 選取建議清單中的某一項 */
  protected pickSuggestion(suggestion: SearchSuggestion) {
    this.suggestionPick.emit(suggestion);
  }
}
