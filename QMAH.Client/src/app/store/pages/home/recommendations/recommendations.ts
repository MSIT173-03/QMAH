import { Component, ElementRef, computed, input, output, viewChild } from '@angular/core';
import { SectionHead, ProductCard } from '../../../component';
import { gridColumns } from '../../../shared/grid-columns';
import { BadgedProductView, HOME_PRODUCT_ROWS } from '../home.data';

/** 首頁「為你推薦」區塊：個人化商品清單，固定只顯示兩行，超出的商品不顯示 */
@Component({
  selector: 'app-recommendations',
  imports: [SectionHead, ProductCard],
  templateUrl: './recommendations.html',
  styleUrl: './recommendations.scss',
})
export class Recommendations {
  /** 推薦商品清單，由首頁向 API 一次取得 */
  items = input<BadgedProductView[]>([]);
  /** 點擊任一商品卡片的加入購物車按鈕時觸發，帶出商品 ID */
  addToCart = output<string>();

  private readonly grid = viewChild<ElementRef<HTMLElement>>('grid');
  private readonly columns = gridColumns(this.grid);
  /** 實際顯示的商品：欄數 × 固定行數，超出的不渲染 */
  protected visibleItems = computed(() => this.items().slice(0, this.columns() * HOME_PRODUCT_ROWS));
}
