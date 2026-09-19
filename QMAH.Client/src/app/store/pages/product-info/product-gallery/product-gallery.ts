import { Component, input } from '@angular/core';
import { CollectibleCard } from '../../../component/collectible-card/collectible-card';

/**
 * 商品主視覺容器。
 * 原本這裡是尚未串接真實圖片的佔位圖庫；保留 selector 與頁面插槽，
 * 只把實際呈現換成獨立的文物收藏卡，避免同一頁同時維護兩套主圖契約。
 */
@Component({
  selector: 'app-product-gallery',
  imports: [CollectibleCard],
  templateUrl: './product-gallery.html',
  styleUrls: [
    './product-gallery.scss',
  ],
})
export class ProductGallery {
  /** 商品名稱 */
  name = input('');
  /** 商品主圖，直接使用既有 Catalog API 的 primaryImagePath。 */
  image = input<string | null>(null);
  /** 文物類型，直接使用既有商品 category。 */
  type = input('');
  /** 商品卡背面的尺寸摘要。 */
  dimensions = input('');
  /** 背面簡述沿用既有商品資料，不新增 API。 */
  description = input('');
}
