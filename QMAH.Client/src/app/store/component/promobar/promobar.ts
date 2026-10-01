import { Component, computed, input, signal } from '@angular/core';
import { CART_PATH, productPath } from '../../shared/paths';
import { StoreLink } from '../../shared/store-link';
import { CartItem, Coupon } from '../../api/api.models';
import { formatDateMD, formatMoney } from '../../shared/format';

/** 購物車懸浮面板最多列出的商品項數，超過的部分合併成「以及另外 n 項商品」 */
const CART_PANEL_MAX_ITEMS = 5;

/**
 * 頁面頂部工具列：左側輪播跑馬燈公告，右側提供點數、折價券與購物車捷徑連結（登入前以停用狀態顯示），
 * 並可展開折價券與購物車懸浮面板，檢視目前可用的折價券與購物車內的商品。
 */
@Component({
  selector: 'app-promobar',
  imports: [StoreLink],
  templateUrl: './promobar.html',
  styleUrl: './promobar.scss',
})
export class Promobar {
  /** 跑馬燈公告文字清單 */
  announcements = input<string[]>([]);

  /** 是否已登入；null 代表尚未確認，與未登入一樣以停用狀態顯示會員捷徑 */
  signedIn = input<boolean | null>(null);
  /** 「點數」連結網址 */
  pointsHref = input('/member/economy');
  /** 目前點數顯示文字 */
  points = input('0');

  /** 「折價券」連結網址 */
  couponsHref = input('/member/coupons');
  /** 折價券面板中「管理所有折價券」連結網址 */
  manageCouponsHref = input('/member/coupons');
  /** 折價券清單資料 */
  coupons = input<Coupon[]>([]);

  /** 「購物車」連結網址 */
  cartHref = input(CART_PATH);
  /** 購物車內商品件數 */
  cartCount = input(0);
  /** 購物車內的商品品項，供懸浮面板列出名稱與數量 */
  cartItems = input<CartItem[]>([]);

  /** 折價券懸浮面板的顯示資料：使用門檻與到期日合併為一行說明 */
  protected couponRows = computed(() =>
    this.coupons().map((coupon) => {
      const threshold = coupon.min > 0 ? `滿 ${formatMoney(coupon.min)}` : '不限金額';
      return {
        off: coupon.off,
        title: coupon.title,
        meta: coupon.due ? `${threshold} · ${formatDateMD(coupon.due)} 到期` : threshold,
      };
    }),
  );

  /** 購物車懸浮面板列出的商品：最多 CART_PANEL_MAX_ITEMS 項，每項可點擊前往商品頁 */
  protected cartRows = computed(() =>
    this.cartItems()
      .slice(0, CART_PANEL_MAX_ITEMS)
      .map((item) => ({ id: item.productId, name: item.name, qty: item.qty, href: productPath(item.productId) })),
  );

  /** 超出面板上限而未列出的商品項數 */
  protected cartRest = computed(() => Math.max(0, this.cartItems().length - CART_PANEL_MAX_ITEMS));

  /** 折價券懸浮面板是否展開 */
  protected open = signal(false);

  /** 購物車懸浮面板是否展開 */
  protected cartOpen = signal(false);
}
