import { Component, computed, inject, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';
import { Product } from '../../../api/api.models';
import { Panel, SectionHead } from '../../../component';
import { CatalogApi } from '../../../api';
import { formatDateMD } from '../../../shared/format';
import { PRODUCT_LIST_PATH, productPath } from '../../../shared/paths';
import { NO_REVIEWS_LABEL, formatRating, formatReviews, toPriceView, toProductView } from '../../../shared/product-view';
import { StoreLink } from '../../../shared/store-link';
import { LucidePackageSearch } from '@lucide/angular';

/** 新品上架顯示的商品數量 */
const NEW_ARRIVAL_COUNT = 4;

/** 首頁「新品上架」面板：橫列式商品清單 */
@Component({
  selector: 'app-new-arrivals',
  imports: [Panel, SectionHead, StoreLink, LucidePackageSearch],
  templateUrl: './new-arrivals.html',
  styleUrl: './new-arrivals.scss',
})
export class NewArrivals {
  /** 點擊任一商品的「加入」按鈕時觸發，帶出商品 ID */
  addToCart = output<string>();

  /** 「更多 →」連結網址：商品列表頁，並套用「新品上架」入口（預設以由新到舊排序） */
  protected readonly moreHref = `${PRODUCT_LIST_PATH}?view=new`;
  /** 新品列的商品詳情連結，沿用商城既有商品頁 route */
  protected readonly productPath = productPath;

  /** 最新上架的商品，依上架日期由新到舊排列 */
  private readonly products = toSignal(
    inject(CatalogApi)
      .getProducts({ order: 3, pageSize: NEW_ARRIVAL_COUNT })
      // 首頁輔助區塊：載入失敗時顯示空面板，不中斷整個首頁。
      .pipe(
        map((page) => page.items),
        catchError(() => of<Product[]>([])),
      ),
    { initialValue: [] },
  );

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
        brand: view.brand,
        name: view.name,
        coverImage: view.coverImage,
        /** 是否為折扣商品，決定價格與標籤是否使用強調色 */
        hasDeal: price.hasDeal,
        priceText: price.price,
        tagText: price.tag,
        ratingText: formatRating(view.rating),
        reviewsText: formatReviews(view.reviews),
        /** 是否有評論；沒有評論時不顯示「0.0」「0 則評論」，改顯示提示文字 */
        hasReviews: view.reviews > 0,
      };
    }),
  );
  /** 尚無評論時的提示文字 */
  protected readonly noReviewsLabel = NO_REVIEWS_LABEL;

  /** 角標日期文字：清單已由新到舊排列，取第一件的上架日期（MM/DD） */
  protected tagText = computed(() => {
    const latest = this.products()[0];
    // ui-integration: 缺少上架日期時使用可讀 fallback，避免 undefined/undefined 出現在正式商城文案。
    return latest?.listedAt ? `NEW · ${formatDateMD(latest.listedAt)}` : 'NEW · 近期上架';
  });
}
