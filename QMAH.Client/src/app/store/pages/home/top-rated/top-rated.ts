import { Component, computed, input, output } from '@angular/core';
import { Panel, SectionHead } from '../../../component';
import { Product } from '../../../api/api.models';
import { PRODUCT_LIST_PATH } from '../../../shared/paths';
import { formatRating, formatReviews, toPriceView, toProductView } from '../../../shared/product-view';
import { StoreLink } from '../../../shared/store-link';

/** 首頁「評價排行」面板：與新品上架相同的橫列式商品清單，依平均評價由高到低排列 */
@Component({
  selector: 'app-top-rated',
  imports: [Panel, SectionHead, StoreLink],
  templateUrl: './top-rated.html',
  styleUrls: [
    './top-rated.scss',
  ],
})
export class TopRated {
  /** 點擊任一商品的「加入」按鈕時觸發，帶出商品 ID */
  addToCart = output<string>();

  /** 評價排行商品，已依名次排列（來自 products/info） */
  products = input<Product[]>([]);

  /** 「更多 →」連結網址：商品列表頁 */
  protected readonly moreHref = PRODUCT_LIST_PATH;

  /** 顯示資料：顯示字串在這裡先行換算，模板中不再處理格式化 */
  protected items = computed(() =>
    this.products().map((product) => {
      const view = toProductView(product);
      const price = toPriceView(view.price, view.was);
      return {
        id: view.id,
        coverImage: view.coverImage,
        brand: view.brand,
        name: view.name,
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
