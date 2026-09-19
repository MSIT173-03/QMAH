import { Component, input, output, signal } from '@angular/core';

/** 關閉時淡出動畫的播放時間（需與 gallery-zoom.scss 的動畫時長一致） */
const CLOSE_ANIMATION_MS = 200;

/**
 * 商品圖片放大檢視：全螢幕覆蓋層，顯示放大後的圖片與縮圖切換列。
 * 開關由外部以 open 控制；關閉時的淡出動畫屬於本元件的呈現細節，
 * 因此在此自行播放，動畫結束後才送出 close 通知外部收起。
 */
@Component({
  selector: 'app-gallery-zoom',
  imports: [],
  templateUrl: './gallery-zoom.html',
  styleUrls: [
    './gallery-zoom.scss',
  ],
})
export class GalleryZoom {
  /** 是否顯示放大檢視 */
  open = input(false);
  /** 放大後圖片的佔位文字 */
  label = input('');
  /** 放大後圖片的網址，無圖片時顯示 label 佔位文字 */
  image = input<string | null>(null);
  /** 縮圖按鈕文字清單 */
  thumbs = input<string[]>([]);
  /** 目前顯示的縮圖索引 */
  activeIndex = input(0);

  /** 覆蓋層底部的操作提示（固定文案） */
  protected readonly hint = '點擊任意處關閉';

  /** 是否正在播放關閉動畫 */
  protected closing = signal(false);
  /** 關閉動畫的計時器 */
  private closeTimer?: ReturnType<typeof setTimeout>;

  /** 點擊覆蓋層任意處：先播放淡出動畫，結束後才通知外部關閉 */
  protected onDismiss(): void {
    if (this.closing()) return;

    this.closing.set(true);
    clearTimeout(this.closeTimer);
    this.closeTimer = setTimeout(() => {
      this.closing.set(false);
      this.close.emit();
    }, CLOSE_ANIMATION_MS);
  }

  /** 點擊縮圖：阻止事件冒泡到覆蓋層，避免切換圖片時一併關閉 */
  protected onPick(index: number, event: Event): void {
    event.stopPropagation();
    this.pick.emit(index);
  }

  /** 淡出動畫播放完畢，要求外部收起放大檢視 */
  close = output<void>();
  /** 點擊縮圖切換顯示的圖片時觸發，帶出縮圖索引 */
  pick = output<number>();
}
