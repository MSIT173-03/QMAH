import { Component, input, output } from '@angular/core';
import { SectionHead, ProductCard } from '../../../component';
import { BadgedProductView } from '../home.data';

/** 首頁「為你推薦」區塊：隨機挑選的商品清單 */
@Component({
  selector: 'app-recommendation-section',
  imports: [SectionHead, ProductCard],
  templateUrl: './recommendation-section.html',
  styleUrls: [
    './recommendation-section.scss',
  ],
})
export class RecommendationSection {
  /** 推薦商品清單，來自 products/info，隨機 10 項 */
  items = input<BadgedProductView[]>([]);
  /** 點擊任一商品卡片的加入購物車按鈕時觸發，帶出商品 ID */
  addToCart = output<string>();
}
