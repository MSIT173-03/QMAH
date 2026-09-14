import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { SiteHeader, HeaderActions, HeaderNavLink, Breadcrumb, BreadcrumbItem, PageTitleRow, SiteFooter, EmptyState, } from "../../component"

import { CartLine } from './cart-line/cart-line';
import { CartSummary } from './cart-summary/cart-summary';
import { CartAddons } from './cart-addons/cart-addons';

import { CartApi } from '../../api/cart.api';
import { CheckoutApi } from '../../api/checkout.api';
import { ShoppingCart } from '../../api/api.models';

import { CartLineData, toCartAddonData, toCartLineData } from './cart.data';
import { HOME_PATH, PRODUCT_LIST_PATH } from '../../shared/paths';

/** 移除一行購物車項目前，淡出動畫的播放時間（需與 cart-line.scss 的動畫時長一致） */
const REMOVE_ANIMATION_MS = 300;

/**
 * 購物車頁面。
 * 統整頁首、麵包屑、標題列、購物車行清單、金額摘要與再加購區塊；
 * 購物車內容與運費規則皆由 API 取得，數量調整、移除（含離場動畫）與再加購
 * 皆在此呼叫 API 並以回應內容更新購物車狀態，各子元件僅負責顯示與回報操作。
 */
@Component({
  selector: 'app-cart',
  host: { class: 'store-app' },
  imports: [SiteHeader, HeaderActions, Breadcrumb, PageTitleRow, SiteFooter, EmptyState, CartLine, CartSummary, CartAddons],
  templateUrl: './cart.html',
  styleUrls: [
    './cart.scss',
  ],
})
export class Cart {
  private readonly cartApi = inject(CartApi);

  /** 麵包屑導覽項目 */
  protected readonly breadcrumbItems: BreadcrumbItem[] = [{ label: '首頁', href: HOME_PATH }, { label: '購物車' }];

  /** 頁首導覽連結 */
  protected readonly navLinks: HeaderNavLink[] = [
    { label: '全部分類', href: PRODUCT_LIST_PATH },
    { label: '限時特賣', href: `${PRODUCT_LIST_PATH}?view=deal` },
  ];

  /** 購物車內容；null 代表尚在載入，每次異動後以 API 回應的內容取代 */
  private readonly cart = signal<ShoppingCart | null>(null);
  /** 結帳選項，購物車頁以預設配送方式與免運門檻試算運費 */
  private readonly options = toSignal(inject(CheckoutApi).getOptions());
  /** 正在執行移除動畫、尚未真正從購物車移除的商品 ID */
  private leavingIds = signal<ReadonlySet<string>>(new Set());

  /** 購物車行清單，供 app-cart-line 逐行顯示；其餘統計數字皆由此換算 */
  protected lines = computed<CartLineData[]>(() => {
    const leavingIds = this.leavingIds();
    return (this.cart()?.items ?? []).map((item) => toCartLineData(item, leavingIds.has(item.productId)));
  });

  /** 購物車內容是否已載入 */
  protected loaded = computed(() => this.cart() !== null);
  /** 購物車是否含有商品 */
  protected hasItems = computed(() => this.lines().length > 0);
  /** 購物車件數，顯示於頁首與標題列 */
  protected count = computed(() => this.lines().reduce((sum, line) => sum + line.qty, 0));

  /** 商品小計（未折扣前金額加總），折扣額與運費規則由 app-cart-summary 自行推導 */
  protected subtotal = computed(() =>
    this.lines().reduce((sum, line) => sum + (line.was ?? line.price) * line.qty, 0),
  );
  /** 應付商品金額（折扣後金額加總） */
  protected payable = computed(() => this.lines().reduce((sum, line) => sum + line.price * line.qty, 0));

  /** 再加購商品清單（購物車內尚未加入的商品） */
  protected addons = computed(() => (this.cart()?.addons ?? []).map(toCartAddonData));

  /** 預設配送方式（第一項）的運費 */
  protected shippingFee = computed(() => this.options()?.shippingOptions[0]?.fee ?? 0);
  /** 滿額免運門檻 */
  protected freeShippingThreshold = computed(() => this.options()?.freeShippingThreshold ?? 0);

  constructor() {
    this.cartApi.getCart().subscribe((cart) => this.cart.set(cart));
  }

  /** 變更某商品的購物車數量；數量減至 0 視同移除 */
  protected onQtyChange(id: string, qty: number): void {
    if (qty <= 0) {
      this.onRemove(id);
      return;
    }
    this.cartApi.updateItem(id, qty).subscribe((cart) => this.cart.set(cart));
  }

  /** 移除購物車中的商品：先觸發離場動畫，動畫結束後才向 API 移除 */
  protected onRemove(id: string): void {
    this.leavingIds.update((ids) => new Set(ids).add(id));
    setTimeout(() => {
      this.cartApi.removeItem(id).subscribe((cart) => {
        this.leavingIds.update((ids) => {
          const next = new Set(ids);
          next.delete(id);
          return next;
        });
        this.cart.set(cart);
      });
    }, REMOVE_ANIMATION_MS);
  }

  /** 將再加購商品加入購物車（數量 1） */
  protected onAddAddon(id: string): void {
    this.cartApi.addItem(id, 1).subscribe((cart) => this.cart.set(cart));
  }
}
