import { Component, computed, input, output } from '@angular/core';
import { Panel } from '../panel/panel';
import { SectionHead } from '../section-head/section-head';
import { Product } from '../../api/api.models';
import { productPath } from '../../shared/paths';
import { formatRating, formatReviews, toPriceView, toProductView } from '../../shared/product-view';
import { StoreLink } from '../../shared/store-link';

/**
 * 橫列式商品清單面板：標題列（標題、標籤、「更多」連結）加上縮圖、品牌、名稱、價格與評價的橫列商品，
 * 每列右側附加入購物車按鈕。首頁的「新品上架」與「評價排行」共用此版型，僅標題與商品資料不同。
 */
@Component({
  selector: 'app-compact-product-list',
  imports: [Panel, SectionHead, StoreLink],
  templateUrl: './compact-product-list.html',
  styleUrls: [
    './compact-product-list.scss',
  ],
})
export class CompactProductList {
  /** 面板標題 */
  title = input('');
  /** 標題旁的標籤文字，為 null 時不顯示 */
  tag = input<string | null>(null);
  /** 「更多 →」連結網址 */
  moreHref = input('#');
  /** 面板的 id，供頁面上的錨點連結使用 */
  anchorId = input<string | null>(null);
  /** 要顯示的商品，依顯示順序排列 */
  products = input<Product[]>([]);

  /** 點擊任一商品的「加入」按鈕時觸發，帶出商品 ID */
  addToCart = output<string>();

  /**
   * 商品顯示資料。
   * 此面板版面與 app-product-card 不同，因此顯示字串在這裡先行換算，模板中不再處理格式化。
   */
  protected items = computed(() =>
    this.products().map((product) => {
      const view = toProductView(product);
      const price = toPriceView(view.price, view.was);
      return {
        id: view.id,
        href: productPath(view.id),
        coverImage: view.coverImage,
        brand: view.brand,
        name: view.name,
        /** 是否為折扣商品，決定價格與標籤是否使用強調色 */
        hasDeal: price.hasDeal,
        priceText: price.price,
        tagText: price.tag,
        hasReviews: view.reviews > 0,
        ratingText: formatRating(view.rating),
        reviewsText: formatReviews(view.reviews),
      };
    }),
  );
}
