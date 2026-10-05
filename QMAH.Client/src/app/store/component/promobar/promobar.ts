import { Component, ElementRef, computed, effect, input, untracked, viewChild } from '@angular/core';
import { CART_PATH, productPath } from '../../shared/paths';
import { StoreLink } from '../../shared/store-link';
import { PromobarPanel } from '../promobar-panel/promobar-panel';
import { CartItem, Coupon } from '../../api/api.models';
import { formatDateMD, formatMoney } from '../../shared/format';

/** 折價券與購物車懸浮面板最多列出的項數，超過的部分合併成「以及另外 n …」一行 */
const PANEL_MAX_ITEMS = 5;

/** 購物車件數變化時，數字放大再恢復原狀的動畫時間（毫秒） */
const COUNT_BUMP_MS = 400;

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

  /** 「折價券」連結網址 */
  couponsHref = input('/member/coupons');
  /** 折價券面板中「兌換折價券」連結網址（折價券商店） */
  couponStoreHref = input('/store/coupons');
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

  /** 以 Web Animations API 播放放大再還原；連續變化時每次都從頭播放，使用者偏好減少動態時不播放 */
  private bumpCartCount(): void {
    const element = this.cartCountLabel()?.nativeElement;
    if (!element || typeof element.animate !== 'function') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    element.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.6)', offset: 0.4 }, { transform: 'scale(1)' }],
      { duration: COUNT_BUMP_MS, easing: 'ease-out' },
    );
  }
}
