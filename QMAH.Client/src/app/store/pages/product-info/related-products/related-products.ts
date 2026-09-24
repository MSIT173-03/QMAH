import { Component, input, output } from '@angular/core';
import { SectionHead, ProductCard } from '../../../component';
import { ProductViewData } from '../../../shared/product-view';

/**
 * 商品頁「同類推薦」區塊：以商品卡片格狀列出同器類的其他商品。
 *
 * 版面與購物車頁的 app-cart-addons、首頁的 app-recommendations 相同
 * （區塊標題 + 商品卡片格狀清單），但三者的卡片變體與傳入欄位各不相同，
 * 合併成共用元件需要額外參數且無法明顯簡化，因此維持各自獨立、不再合併。
 */
@Component({
  selector: 'app-related-products',
  imports: [SectionHead, ProductCard],
  templateUrl: './related-products.html',
  styleUrl: './related-products.scss',
})
export class RelatedProducts {
  /** 同類推薦商品清單 */
  items = input<ProductViewData[]>([]);

  /** 以下為區塊的固定版面文字 */
  protected readonly title = '同類推薦';
  protected readonly tag = 'RELATED';

  /** 點擊任一商品的加入購物車按鈕時觸發，帶出商品 ID */
  addToCart = output<string>();
}
