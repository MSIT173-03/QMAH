import { Component, input } from '@angular/core';
import { StoreLink } from '../../shared/store-link';

/**
 * 購物車入口連結：顯示購物車圖示與商品件數，點擊後導向購物車頁面。
 */
@Component({
  selector: 'app-cart-link',
  imports: [StoreLink],
  templateUrl: './cart-link.html',
  styleUrls: [
    './cart-link.scss',
  ],
})
export class CartLink {
  /** 購物車連結網址 */
  href = input('');
  /** 購物車內商品數量 */
  count = input(0);
  /** 首頁 hero 版面使用的高度／間距變體 */
  hero = input(false);
}
