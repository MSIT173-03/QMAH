import { Component, computed, input, output } from '@angular/core';
import { Panel, SectionHead } from '../../../component';
import { Product } from '../../../api/api.models';
import { formatDateMD } from '../../../shared/format';
import { PRODUCT_LIST_PATH } from '../../../shared/paths';
import { formatRating, formatReviews, toPriceView, toProductView } from '../../../shared/product-view';
import { StoreLink } from '../../../shared/store-link';

/** 首頁「新品上架」面板：橫列式商品清單 */
@Component({
  selector: 'app-new-arrivals',
  imports: [Panel, SectionHead, StoreLink],
  templateUrl: './new-arrivals.html',
  styleUrls: [
    './new-arrivals.scss',
  ],
})
export class NewArrivals {
  /** 點擊任一商品的「加入」按鈕時觸發，帶出商品 ID */
  addToCart = output<string>();

  /** 「更多 →」連結網址：商品列表頁，並套用「新品上架」入口（預設以由新到舊排序） */
  protected readonly moreHref = `${PRODUCT_LIST_PATH}?view=new`;

  /** 最新上架的商品，依上架日期由新到舊排列（來自 products/info） */
  products = input<Product[]>([]);

  /**
   * 新品商品顯示資料。
   * 此面板版面與 app-product-card 不同，因此顯示字串在這裡先行換算，模板中不再處理格式化。
   */
  protected items = computed(() =>
    this.products().map((product) => {
      const view = toProductView(product);
      const price = toPriceView(view.price, view.was);
      return {
        id: view.id,
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

  /** 角標日期文字：清單已由新到舊排列，取第一件的上架日期（MM/DD） */
  protected tagText = computed(() => {
    const latest = this.products()[0];
    return latest ? `NEW · ${formatDateMD(latest.listedAt)}` : 'NEW';
  });
}
