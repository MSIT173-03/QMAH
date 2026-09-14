import { Component, input, output } from '@angular/core';
import { SectionHead, ProductCard } from '../../../component';
import { ProductViewData } from '../../../shared/product-view';

/**
 * 商品頁「同類推薦」區塊：以商品卡片格狀列出同器類的其他商品。
 *
 * 版面與購物車頁的 app-cart-addons、首頁的 app-recommendations 相同
 * （區塊標題 + 商品卡片格狀清單），僅標題文案與卡片變體不同；
 * 三者是否合併為共用的「商品卡片區塊」元件，待確認後再處理。
 */
@Component({
  selector: 'app-related-products',
  imports: [SectionHead, ProductCard],
  templateUrl: './related-products.html',
  styleUrls: [
    './related-products.scss',
  ],
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
