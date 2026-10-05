import { Component, ElementRef, computed, effect, input, untracked, viewChild } from '@angular/core';
import { bumpElement } from '../../shared/bump';
import { CART_PATH, COUPON_STORE_PATH, productPath } from '../../shared/paths';
import { StoreLink } from '../../shared/store-link';
import { PromobarPanel } from '../promobar-panel/promobar-panel';
import { CartItem, Coupon } from '../../api/api.models';
import { formatDateMD, formatMoney } from '../../shared/format';

/** 折價券與購物車懸浮面板最多列出的項數，超過的部分合併成「以及另外 n …」一行 */
const PANEL_MAX_ITEMS = 5;

/**
 * 頁面頂部工具列：左側輪播跑馬燈公告，右側提供點數、折價券與購物車捷徑連結（登入前以停用狀態顯示），
 * 並可展開折價券與購物車懸浮面板，檢視目前可用的折價券與購物車內的商品。
 */
@Component({
  selector: 'app-promobar',
  imports: [StoreLink, PromobarPanel],
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

  /** 「折價券」連結網址：兌換商店（含我的折價券） */
  couponsHref = input(COUPON_STORE_PATH);
  /** 折價券清單資料 */
  coupons = input<Coupon[]>([]);

  /** 「購物車」連結網址 */
  cartHref = input(CART_PATH);
  /** 購物車內商品件數 */
  cartCount = input(0);
  /** 購物車內容是否已載入；載入前的 0 不是真的「變化」，載入完成帶出的初始件數也不播放動畫 */
  cartLoaded = input(true);
  /** 購物車內的商品品項，供懸浮面板列出名稱與數量 */
  cartItems = input<CartItem[]>([]);

  /** 折價券懸浮面板的顯示資料：最多 PANEL_MAX_ITEMS 張，使用門檻與到期日合併為一行說明 */
  protected couponRows = computed(() =>
    this.coupons()
      .slice(0, PANEL_MAX_ITEMS)
      .map((coupon) => {
        const threshold = coupon.min > 0 ? `滿 ${formatMoney(coupon.min)}` : '不限金額';
        return {
          off: coupon.off,
          title: coupon.title,
          meta: coupon.due ? `${threshold} · ${formatDateMD(coupon.due)} 到期` : threshold,
          id: coupon.id
        };
      }),
  );

  /** 超出面板上限而未列出的折價券張數 */
  protected couponRest = computed(() => Math.max(0, this.coupons().length - PANEL_MAX_ITEMS));

  /** 購物車懸浮面板列出的商品：最多 PANEL_MAX_ITEMS 項，每項可點擊前往商品頁 */
  protected cartRows = computed(() =>
    this.cartItems()
      .slice(0, PANEL_MAX_ITEMS)
      .map((item) => ({ id: item.productId, name: item.name, qty: item.qty, href: productPath(item.productId) })),
  );

  /** 超出面板上限而未列出的商品項數 */
  protected cartRest = computed(() => Math.max(0, this.cartItems().length - PANEL_MAX_ITEMS));

  private readonly cartCountLabel = viewChild<ElementRef<HTMLElement>>('cartCountLabel');

  constructor() {
    // 購物車件數變化（例如加入購物車）時，讓數字放大一下再恢復原狀；
    // 首次載入（含登入後購物車才載入完成）帶出的件數只當作基準，不播放。
    let previous: number | null = null;
    effect(() => {
      const count = this.cartCount();
      if (!this.cartLoaded()) {
        previous = null;
        return;
      }
      if (previous !== null && previous !== count) untracked(() => this.bumpCartCount());
      previous = count;
    });
  }

  /** 購物車件數的數字放大再還原 */
  private bumpCartCount(): void {
    bumpElement(this.cartCountLabel()?.nativeElement);
  }
}
