import { Component, computed, inject, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { Panel } from '../../../component/panel/panel';
import { SectionHead } from '../../../component/section-head/section-head';
import { CatalogApi } from '../../../api/catalog.api';
import { formatDateMD, formatMoney } from '../../../shared/format';
import { PRODUCT_LIST_PATH } from '../../../shared/paths';
import { toCardData } from '../home.data';

/** 新品上架顯示的商品數量 */
const NEW_ARRIVAL_COUNT = 4;
/** 無折扣商品的標籤文字 */
const STANDARD_TAG_LABEL = '定價商品';

/** 首頁「新品上架」面板：橫列式商品清單 */
@Component({
  selector: 'app-new-arrivals',
  imports: [Panel, SectionHead, RouterLink],
  templateUrl: './new-arrivals.html',
  styleUrls: [
    './new-arrivals.scss',
  ],
})
export class NewArrivals {
  /** 點擊任一商品的「加入」按鈕時觸發，帶出商品 ID */
  addToCart = output<string>();

  /** 「更多 →」連結網址：商品列表頁，並套用「新品上架」入口（預設以由新到舊排序） */
  protected readonly moreHref = PRODUCT_LIST_PATH;
  protected readonly moreQueryParams = { view: 'new' };

  /** 最新上架的商品，依上架日期由新到舊排列 */
  private readonly products = toSignal(
    inject(CatalogApi)
      .getProducts({ sort: 'new', pageSize: NEW_ARRIVAL_COUNT })
      .pipe(map((page) => page.items)),
    { initialValue: [] },
  );

  /**
   * 新品商品顯示資料。
   * 此面板版面與 app-product-card 不同，因此顯示字串在這裡先行換算，模板中不再處理格式化。
   */
  protected items = computed(() =>
    this.products().map((product) => {
      const card = toCardData(product, 'NEW');
      const was = card.was;
      return {
        id: card.id,
        brand: card.brand,
        name: card.name,
        /** 是否為折扣商品，決定價格與標籤是否使用強調色 */
        hasDeal: was !== null,
        priceText: formatMoney(card.price),
        tagText: was === null ? STANDARD_TAG_LABEL : `-${Math.round((1 - card.price / was) * 100)}%`,
        ratingText: card.rating.toFixed(1),
        reviewsText: `${card.reviews.toLocaleString('en-US')} 則評論`,
      };
    }),
  );

  /** 角標日期文字：清單已由新到舊排列，取第一件的上架日期（MM/DD） */
  protected tagText = computed(() => {
    const latest = this.products()[0];
    return latest ? `NEW · ${formatDateMD(latest.listedAt)}` : 'NEW';
  });
}
