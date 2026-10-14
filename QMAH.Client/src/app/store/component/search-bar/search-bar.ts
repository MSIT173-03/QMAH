import { Component, ElementRef, input, model, output, viewChild } from '@angular/core';

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
  /** 常見搜尋詞（完整版才顯示）；預設為商城現有的分類名稱 */
  suggestions = input<string[]>(['青銅器', '陶瓷', '玉器', '繪畫', '錢幣', '漆器', '琺瑯器', '雕刻', '青花', '乾隆', '複製品', '明信片']);

  /** 搜尋框目前輸入值（雙向綁定） */
  value = model('');
  /** 送出搜尋（按 Enter 或點擊搜尋按鈕）時觸發，帶出去除頭尾空白的關鍵字 */
  search = output<string>();

  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  /** 表單送出（按 Enter、手機鍵盤的搜尋鍵或搜尋按鈕都會走這裡）；輸入法組字中的 Enter 瀏覽器不會送出 */
  protected onSubmit(event: Event) {
    event.preventDefault();
    const typed = this.inputRef()?.nativeElement.value;
    if (typed !== undefined) this.value.set(typed);
    this.submit();
  }

  /** 同步輸入框內容到 value */
  protected onInput(event: Event) {
    this.value.set((event.target as HTMLInputElement).value);
  }

  /** 送出搜尋關鍵字 */
  protected submit() {
    this.search.emit(this.value().trim());
  }

  /** 點選常見搜尋詞：填入輸入框並直接送出 */
  protected pickSuggestion(term: string) {
    this.value.set(term);
    this.submit();
  }
}
