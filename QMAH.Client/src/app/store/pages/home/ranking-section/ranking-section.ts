import { Component, computed, input, output } from '@angular/core';
import { SectionHead, ProductCard } from '../../../component';
import { Product } from '../../../api/api.models';
import { pad } from '../../../shared/format';
import { toProductView } from '../../../shared/product-view';
import { BadgedProductView } from '../home.data';

/** 首頁「熱銷排行」區塊：依販賣數量列出商品，角標為名次 */
@Component({
  selector: 'app-ranking-section',
  imports: [SectionHead, ProductCard],
  templateUrl: './ranking-section.html',
  styleUrls: [
    './ranking-section.scss',
  ],
})
export class RankingSection {
  /** 點擊任一商品卡片的加入購物車按鈕時觸發，帶出商品 ID */
  addToCart = output<string>();

  /** 熱銷排行商品，已依名次排列（來自 products/info，販賣數量前 10 項） */
  products = input<Product[]>([]);

  /** 排行商品卡片資料，角標為排名序號 */
  protected rankingItems = computed((): BadgedProductView[] =>
    this.products().map((item, i) => ({
      ...toProductView(item),
      badge: `#${pad(i + 1)}`,
      badgeVariant: 'ink',
    })),
  );
}
