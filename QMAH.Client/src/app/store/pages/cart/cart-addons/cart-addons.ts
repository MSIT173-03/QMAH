import { Component, input, output } from '@angular/core';
import { SectionHead } from '../../../component/section-head/section-head';
import { ProductCard } from '../../../component/product-card/product-card';
import { CartAddonData } from '../cart.data';

/** 購物車頁「再加購」區塊：顯示購物車內尚未加入的商品，精簡版商品卡片 */
@Component({
  selector: 'app-cart-addons',
  imports: [SectionHead, ProductCard],
  templateUrl: './cart-addons.html',
  styleUrls: [
    './cart-addons.scss',
  ],
})
export class CartAddons {
  /** 再加購商品清單 */
  items = input<CartAddonData[]>([]);
  /** 點擊任一商品的加入購物車按鈕時觸發，帶出商品 ID */
  addToCart = output<string>();
}
