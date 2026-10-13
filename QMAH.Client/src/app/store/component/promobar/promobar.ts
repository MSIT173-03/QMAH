import { Component, ElementRef, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { bumpElement } from '../../shared/bump';
import { CART_PATH, COUPON_STORE_PATH, ORDERS_PATH, productPath } from '../../shared/paths';
import { StoreLink } from '../../shared/store-link';
import { PromobarPanel } from '../promobar-panel/promobar-panel';
import { CartItem, Coupon } from '../../api/api.models';
import { formatDateMD, formatMoney } from '../../shared/format';
import { cartSuggestion, couponSaving } from '../../shared/coupon-saving';
import { OrdersApi } from '../../api/orders.api';
import { MyOrder } from '../../api/api.models';

/** 折價券與購物車懸浮面板最多列出的項數，超過的部分合併成「以及另外 n …」一行 */
const PANEL_MAX_ITEMS = 5;

/**
 * 頁面頂部工具列：左側輪播跑馬燈公告，右側提供點數、折價券與購物車捷徑連結（登入前的行為見各項說明），
 * 並可展開折價券與購物車懸浮面板，檢視目前可用的折價券與購物車內的商品。
 */
/** 幾天內到期算「快到期」，在面板排最前並改顯示剩餘天數 */
const SOON_DAYS = 14;

function daysLeft(coupon: Coupon): number | null {
  return coupon.due ? Math.ceil((new Date(`${coupon.due}T23:59:59`).getTime() - Date.now()) / 86_400_000) : null;
}

/** 快到期的排前面（越近越前），其餘一律同級 */
function couponUrgency(coupon: Coupon): number {
  const days = daysLeft(coupon);
  return days !== null && days <= SOON_DAYS ? days : Number.MAX_SAFE_INTEGER;
}

@Component({
  selector: 'app-promobar',
  imports: [StoreLink, PromobarPanel],
  host: { '[class.is-inline]': 'inline()' },
  templateUrl: './promobar.html',
  styleUrl: './promobar.scss',
})
export class Promobar {
  /** 併入頁首同一排：公告在左、搜尋框置中、會員捷徑在右，本身不再獨佔一條 */
  inline = input(false);

  /** 跑馬燈公告文字清單 */
  announcements = input<string[]>([]);

  /** 是否已登入；null 代表尚未確認，與未登入一樣只顯示名稱（點數停用、折價券可前往兌換商店、購物車要求登入） */
  signedIn = input<boolean | null>(null);
  /** 「點數」連結網址 */
  pointsHref = input('/member/economy?from=store');
  /** 目前點數顯示文字 */
  points = input('0');

  /** 「折價券」連結網址：兌換商店（含我的折價券） */
  couponsHref = input(COUPON_STORE_PATH);
  /** 折價券清單資料 */
  coupons = input<Coupon[]>([]);

  /** 「購物車」連結網址 */
  cartHref = input(CART_PATH);
  /** 「我的訂單」連結網址：我的訂單頁 */
  ordersHref = input(ORDERS_PATH);
  /** 購物車內商品件數 */
  cartCount = input(0);
  /** 購物車內容是否已載入；載入前的 0 不是真的「變化」，載入完成帶出的初始件數也不播放動畫 */
  cartLoaded = input(true);
  /** 購物車內的商品品項，供懸浮面板列出名稱與數量 */
  cartItems = input<CartItem[]>([]);

  /** 未登入時點擊「購物車」；由外層開啟登入提示 */
  cartLoginRequest = output<void>();

  /** 折價券懸浮面板的顯示資料：最多 PANEL_MAX_ITEMS 張，使用門檻與到期日合併為一行說明 */
  protected couponRows = computed(() =>
    [...this.coupons()]
      .sort((a, b) => couponUrgency(a) - couponUrgency(b) || couponSaving(b, b.min) - couponSaving(a, a.min))
      .slice(0, PANEL_MAX_ITEMS)
      .map((coupon) => {
        const threshold = coupon.min > 0 ? `滿 ${formatMoney(coupon.min)}` : '不限金額';
        const days = daysLeft(coupon);
        return {
          off: coupon.off,
          title: coupon.title,
          meta: coupon.due ? `${threshold} · ${days !== null && days <= SOON_DAYS ? `剩 ${Math.max(days, 0)} 天` : `${formatDateMD(coupon.due)} 到期`}` : threshold,
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
      .map((item) => ({
        id: item.productId,
        name: item.name,
        qty: item.qty,
        image: item.coverImage,
        unit: formatMoney(item.price),
        total: formatMoney(item.lineTotal),
        href: productPath(item.productId),
      })),
  );

  /** 滿額免運門檻，與後端 CheckoutDtos.FreeShippingThreshold、floating-cart 一致 */
  private readonly freeShippingThreshold = 1500;
  /** 購物車小計（折扣後、不含運費與折價券） */
  private readonly cartSubtotalValue = computed(() => this.cartItems().reduce((sum, item) => sum + item.lineTotal, 0));
  /** 目前購物車可直接折抵的點數：每單上限 50、不超過商品金額 5%、也不超過持有點數（與後端 GetDirectPointCap 一致） */
  protected pointsUsable = computed(() =>
    Math.min(50, Math.floor(this.cartSubtotalValue() * 0.05), Number(String(this.points()).replace(/,/g, '')) || 0),
  );
  protected cartSubtotal = computed(() => formatMoney(this.cartSubtotalValue()));
  /** 免運進度：百分比與提示文字 */
  protected shipPercent = computed(() => Math.min(100, (this.cartSubtotalValue() / this.freeShippingThreshold) * 100));
  protected shipHint = computed(() => {
    const left = this.freeShippingThreshold - this.cartSubtotalValue();
    return left > 0 ? `再買 ${formatMoney(left)} 享免運` : '已享免運';
  });

  /** 購物車省錢建議：折價券、差額提示或點數折抵（與懸浮購物車同一套邏輯） */
  protected cartTip = computed(() => cartSuggestion(this.coupons(), this.cartSubtotalValue()));

  /** 超出面板上限而未列出的商品項數 */
  protected cartRest = computed(() => Math.max(0, this.cartItems().length - PANEL_MAX_ITEMS));

  private readonly ordersApi = inject(OrdersApi);
  private ordersLoadedAt = 0;
  /** 最近一頁訂單（第一次展開「我的訂單」小窗時載入，60 秒內不重複請求）；null＝尚未載入 */
  private readonly recentOrders = signal<MyOrder[] | null>(null);
  protected readonly ordersLoading = computed(() => this.recentOrders() === null);

  /** 各狀態的件數（只算最近一頁，標示「最近 N 筆」） */
  protected readonly orderCounts = computed(() => {
    const orders = this.recentOrders() ?? [];
    const count = (...statuses: string[]) => orders.filter((order) => statuses.includes(order.status)).length;
    return [
      { label: '待付款', n: count('PENDING_PAYMENT'), tone: 'warn' },
      { label: '處理中', n: count('PAID', 'FULFILLING'), tone: 'info' },
      { label: '已寄送', n: count('SHIPPED'), tone: 'info' },
      { label: '已完成', n: count('COMPLETED'), tone: 'ok' },
      { label: '已取消', n: count('CANCELLED'), tone: 'mute' },
    ];
  });
  protected readonly orderTotal = computed(() => this.recentOrders()?.length ?? 0);
  /** 最新一筆訂單的摘要 */
  protected readonly latestOrder = computed(() => {
    const order = this.recentOrders()?.[0];
    if (!order) return null;
    const labels: Record<string, string> = {
      PENDING_PAYMENT: '待付款', PAID: '已付款', FULFILLING: '撿貨中', SHIPPED: '已寄送', COMPLETED: '已完成', CANCELLED: '已取消',
    };
    return {
      no: order.orderNo,
      status: labels[order.status] ?? order.status,
      amount: formatMoney(order.totalAmount),
      date: formatDateMD(order.createdAt),
      qty: order.items.reduce((sum, line) => sum + line.quantity, 0),
    };
  });

  protected loadOrders(): void {
    if (Date.now() - this.ordersLoadedAt < 60_000) return;
    this.ordersLoadedAt = Date.now();
    this.ordersApi.getMyOrders(1).subscribe({
      next: (page) => this.recentOrders.set(page.items),
      error: () => {
        this.ordersLoadedAt = 0;
        this.recentOrders.set([]);
      },
    });
  }

  private readonly cartCountLabel = viewChild<ElementRef<HTMLElement>>('cartCountLabel');

  constructor() {
    // 登入後就先把最近訂單載好，使用者第一次移到「我的訂單」時小窗已經有內容，不必等待
    effect(() => {
      if (this.signedIn() === true) untracked(() => this.loadOrders());
    });
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
