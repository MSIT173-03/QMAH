import { Component, computed, input } from '@angular/core';
import { ProductCard } from '../product-card/product-card';

/**
 * 商品橫列：商品列表頁「列表顯示」模式使用的單一商品版位，
 * 左側縮圖、中段商品資訊與出處說明、右側價格與加入購物車按鈕。
 *
 * 繼承 app-product-card：商品欄位與顯示字串（getPrice、getWas、getTag、hasDeal…）
 * 全部沿用商品卡片的定義，只有版面模板不同。
 */
@Component({
  selector: 'app-product-row',
  imports: [],
  templateUrl: './product-row.html',
  styleUrls: [
    './product-row.scss',
  ],
})
export class ProductRow extends ProductCard {
  /** 器類名稱，與品牌併排顯示於第一行 */
  cat = input('');
  /** 紋樣／器型出處說明 */
  source = input('');

  /** 橫列固定使用列表頁的評論數後綴，不隨 variant 變動 */
  protected override getReviews = computed(() => `${this.reviews().toLocaleString('en-US')} 則`);
}
