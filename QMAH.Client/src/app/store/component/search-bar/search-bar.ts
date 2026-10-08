import { Component, input, model, output } from '@angular/core';

/**
 * 搜尋框元件：提供關鍵字輸入與送出搜尋（按 Enter 或搜尋按鈕）。
 * compact 模式（商品列表頁與商品頁使用）寬度可隨頁首伸縮，輸入框本身的尺寸與完整版一致。
 */
@Component({
  selector: 'app-search-bar',
  templateUrl: './search-bar.html',
  styleUrl: './search-bar.scss',
})
export class SearchBar {
  /** 輸入框提示文字 */
  placeholder = input('搜尋文物周邊、紋樣');
  /** 精簡版：寬度可隨頁首伸縮，用於商品列表頁與商品頁 */
  compact = input(false);

  /** 搜尋框目前輸入值（雙向綁定） */
  value = model('');
  /** 送出搜尋（按 Enter 或點擊搜尋按鈕）時觸發，帶出去除頭尾空白的關鍵字 */
  search = output<string>();

  /** 同步輸入框內容到 value */
  protected onInput(event: Event) {
    this.value.set((event.target as HTMLInputElement).value);
  }

  /** 送出搜尋關鍵字 */
  protected submit() {
    this.search.emit(this.value().trim());
  }
}
