import { Component, computed, input, signal } from '@angular/core';
import { ImageMagnifier, CollectibleCard } from '../../../component';

type ViewMode = 'static' | 'dynamic';

/**
 * 商品詳情的圖庫：靜態檢視可在明信片正面與原文物原圖（套組內縮小複製品使用的影像）之間切換，
 * 翻面檢視載入 app-collectible-card，可翻轉查看明信片背面的基本資料；兩種檢視都可旋轉觀看方向。
 * 商品列表不使用此元件，仍維持低成本的靜態縮圖。
 */
@Component({
  selector: 'app-product-gallery',
  imports: [CollectibleCard, ImageMagnifier],
  templateUrl: './product-gallery.html',
  styleUrl: './product-gallery.scss',
})
export class ProductGallery {
  /** 明信片正面顯示的原文物名稱，不帶商品套組後綴。 */
  name = input('');
  /** 原文物主圖，正面與縮小複製品視圖共用同一張授權來源圖。 */
  image = input<string | null>(null);
  /** 文物類型，放在明信片正面的小字資訊中。 */
  type = input('');
  /** 第二個靜態視圖只顯示原文物尺寸，不重複顯示人人都知道的 A6。 */
  dimensions = input('');
  /** 第二個視圖使用的原文物簡述。 */
  description = input('');

  /** 檢視模式：靜態（預設）或翻面（3D 明信片） */
  protected selectedMode = signal<ViewMode>('static');
  /** 靜態模式切換明信片正面與複製品原圖。 */
  protected selectedView = signal<'postcard' | 'original'>('postcard');
  /** 圖片載入後依原始比例切換版型；畫面不把方向印在明信片上。 */
  protected orientation = signal<'portrait' | 'landscape'>('landscape');
  /** 是否旋轉 90 度觀看；只改變觀看方向，不改變依圖片判定的版型 */
  protected rotated = signal(false);

  /** 目前是否顯示靜態的明信片正面 */
  protected isPostcardView = computed(() => this.selectedMode() === 'static' && this.selectedView() === 'postcard');
  /** 目前是否顯示靜態的複製品原圖 */
  protected isOriginalView = computed(() => this.selectedMode() === 'static' && this.selectedView() === 'original');
  /** 轉交給明信片與放大鏡的旋轉角度 */
  protected rotation = computed(() => (this.rotated() ? 90 : 0));

  protected onImageLoad(size: { width: number; height: number }): void {
    this.orientation.set(size.height > size.width ? 'portrait' : 'landscape');
  }

  /** 動態模式的子元件自行處理放大鏡，這張不可見探針只同步外框方向。 */
  protected onNativeImageLoad(event: Event): void {
    const image = event.currentTarget as HTMLImageElement;
    this.onImageLoad({ width: image.naturalWidth, height: image.naturalHeight });
  }
}
