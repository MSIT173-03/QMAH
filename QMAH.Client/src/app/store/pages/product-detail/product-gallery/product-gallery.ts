import { Component, input, signal } from '@angular/core';
import { CollectibleCard } from '../../../component/collectible-card/collectible-card';
import { ImageMagnifier } from '../../../component/image-magnifier/image-magnifier';

type ViewMode = 'static' | 'dynamic';

/**
 * 商品詳情的靜態視圖切換器。
 * 第一個視圖是明信片正面，第二個視圖是套組內縮小複製品使用的原文物影像；
 * 商品列表不使用此元件，因此仍維持低成本靜態縮圖。
 */
@Component({
  selector: 'app-product-gallery',
  imports: [CollectibleCard, ImageMagnifier],
  templateUrl: './product-gallery.html',
  styleUrls: [
    './product-gallery.scss',
  ],
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

  /** 靜態預覽是預設模式；動態模式只在詳情頁載入既有 3D 翻面。 */
  protected selectedMode = signal<ViewMode>('static');
  /** 靜態模式切換明信片正面與複製品原圖。 */
  protected selectedView = signal<'postcard' | 'original'>('postcard');
  /** 圖片載入後依原始比例切換版型；畫面不把方向印在明信片上。 */
  protected orientation = signal<'portrait' | 'landscape'>('landscape');
  /** 旋轉整張卡片觀看，不改變單件商品原本的自動版型。 */
  protected rotated = signal(false);

  protected onImageLoad(size: { width: number; height: number }): void {
    this.orientation.set(size.height > size.width ? 'portrait' : 'landscape');
  }

  /** 動態模式的子元件自行處理放大鏡，這張不可見探針只同步外框方向。 */
  protected onNativeImageLoad(event: Event): void {
    const image = event.currentTarget as HTMLImageElement;
    this.onImageLoad({ width: image.naturalWidth, height: image.naturalHeight });
  }
}
