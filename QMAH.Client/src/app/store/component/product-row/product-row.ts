import { Component, computed, input, output } from '@angular/core';
import { QmahIconComponent } from '../../../shared/components/qmah-icon/qmah-icon';
import { imageWithFallback } from '../../shared/image-utils';
import { productPath } from '../../shared/paths';
import { NO_REVIEWS_LABEL, formatRating, formatReviews, toPriceView } from '../../shared/product-view';
import { StoreLink } from '../../shared/store-link';

/**
 * 商品橫列：商品列表頁「列表顯示」模式使用的單一商品版位，
 * 左側縮圖、中段商品資訊與出處說明、右側價格與加入購物車按鈕。
 * 價格列與評分的顯示字串與 app-product-card 共用 shared/product-view 的換算函式。
 */
@Component({
  selector: 'app-product-row',
  imports: [StoreLink, QmahIconComponent],
  templateUrl: './product-row.html',
  styleUrls: [
    './product-row.scss',
  ],
})
export class ProductRow {
  id = input('');
  /** 商品圖片網址；錯誤時會先嘗試同目錄 display 圖。 */
  coverImage = input<string | null>(null);
  /** 品牌名稱 */
  brand = input('');
  /** 器類名稱，與品牌併排顯示於第一行 */
  cat = input('');
  /** 商品名稱 */
  name = input('');
  /** 紋樣／器型出處說明 */
  source = input('');
  /** 折扣後售價 */
  price = input(0);
  /** 折扣前原價，為 null 時代表無折扣 */
  was = input<number | null>(null);
  /** 評分 */
  rating = input(0);
  /** 評論數 */
  reviews = input(0);

  /** 點擊加入購物車按鈕時觸發 */
  addToCart = output<void>();

  /** 無圖片時顯示的中性狀態。 */
  protected readonly slotLabel = '影像待補';
  /** 加入購物車按鈕文字 */
  protected readonly addCartLabel = '加入購物車';

  /** 商品圖片；讀取失敗時先 fallback 到同一件文物 display 圖。 */
  protected readonly image = imageWithFallback(() => this.coverImage());

  /** 商品頁連結網址 */
  protected link = computed(() => productPath(this.id()));
  /** 價格列顯示字串 */
  protected priceView = computed(() => toPriceView(this.price(), this.was()));
  /** 評分顯示字串 */
  protected ratingText = computed(() => formatRating(this.rating()));
  /** 評論數顯示字串，橫列使用較短的後綴 */
  protected reviewsText = computed(() => formatReviews(this.reviews(), '則'));
  /** 是否有評論；沒有評論時不顯示「0.0」「0 則」，改顯示提示文字 */
  protected hasReviews = computed(() => this.reviews() > 0);
  /** 尚無評論時的提示文字 */
  protected readonly noReviewsLabel = NO_REVIEWS_LABEL;
}
