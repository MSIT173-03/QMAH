import { Component, computed, input, signal } from '@angular/core';
import { GalleryZoom } from '../gallery-zoom/gallery-zoom';

/**
 * 商品圖庫：主圖與下方縮圖列，點擊主圖可開啟放大檢視。
 * 目前顯示的視角、放大檢視是否開啟皆為本元件自己的呈現狀態，
 * 因此不由外部傳入，外部只需提供商品名稱與圖片視角清單。
 */
@Component({
  selector: 'app-product-gallery',
  imports: [GalleryZoom],
  templateUrl: './product-gallery.html',
  styleUrls: [
    './product-gallery.scss',
  ],
})
export class ProductGallery {
  /** 商品名稱，組成主圖與放大檢視的佔位文字 */
  name = input('');
  /** 商品圖片的視角名稱清單（佔位資料，正式應為商品圖片清單） */
  views = input<string[]>([]);
  /** 各視角對應的圖片網址（與 views 同序），無圖片時為 null 並顯示佔位文字 */
  images = input<(string | null)[]>([]);

  /** 主圖覆蓋層的操作提示（固定文案） */
  protected readonly overlayLabel = '點擊放大 · 檢視細節';

  /** 目前顯示的視角索引 */
  protected shot = signal(0);
  /** 放大檢視是否開啟 */
  protected zoomOpen = signal(false);

  /** 目前視角的圖片網址 */
  protected currentImage = computed(() => this.images()[this.shot()] ?? null);
  /** 縮圖顯示資料：文字標籤與圖片網址 */
  protected thumbs = computed(() =>
    this.views().map((view, i) => ({ label: `[ ${view} ]`, url: this.images()[i] ?? null })),
  );

  /** 目前視角名稱 */
  private currentView = computed(() => this.views()[this.shot()] ?? '');
  /** 主圖佔位文字 */
  protected mainSlot = computed(() => `[ ${this.currentView()} · ${this.name()} 1200×1200 ]`);
  /** 放大檢視的圖片佔位文字 */
  protected zoomSlot = computed(() => `[ 放大檢視 · ${this.currentView()} · ${this.name()} 2400×2400 ]`);
  /** 縮圖按鈕文字，主圖與放大檢視共用 */
  protected thumbLabels = computed(() => this.views().map((view) => `[ ${view} ]`));
}
