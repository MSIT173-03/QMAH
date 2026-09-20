import { Component, computed, signal } from '@angular/core';

import {
  SiteHeader,
  HeaderActions,
  HeaderNavLink,
  Breadcrumb,
  BreadcrumbItem,
  PageTitleRow,
  EmptyState,
} from '../../component';
import { HOME_PATH, PRODUCT_LIST_PATH } from '../../shared/paths';
import { injectCartState } from '../../shared/page-state';
import { toProductView } from '../../shared/product-view';

import { CartLine } from './cart-line/cart-line';
import { CartSummary } from './cart-summary/cart-summary';
import { CartAddons } from './cart-addons/cart-addons';
import { CartLineData, toCartLineData } from './cart.data';

/** 移除一行購物車項目前，淡出動畫的播放時間（需與 cart-line.scss 的動畫時長一致） */
const REMOVE_ANIMATION_MS = 300;

/**
 * 購物車頁面。
 * 統整頁首、麵包屑、標題列、購物車行清單、金額摘要與再加購區塊；
 * 購物車內容與所有金額皆由 API 取得，數量調整、移除（含離場動畫）與再加購
 * 皆在此呼叫 API 並以回應內容更新購物車狀態，各子元件僅負責顯示與回報操作。
 */
@Component({
  selector: 'app-cart',
  host: { class: 'store-app' },
  imports: [SiteHeader, HeaderActions, Breadcrumb, PageTitleRow, EmptyState, CartLine, CartSummary, CartAddons],
  templateUrl: './cart.html',
  styleUrls: [
    './cart.scss',
  ],
})
export class Cart {
  /** 麵包屑導覽項目 */
  protected readonly breadcrumbItems: BreadcrumbItem[] = [{ label: '首頁', href: HOME_PATH }, { label: '購物車' }];

  /** 頁首導覽連結 */
  protected readonly navLinks: HeaderNavLink[] = [
    { label: '全部分類', href: PRODUCT_LIST_PATH },
    { label: '限時特賣', href: `${PRODUCT_LIST_PATH}?view=deal` },
  ];

  /** 頁面標題列右側連結 */
  protected readonly continueShoppingLink = { label: '繼續選購 →', href: PRODUCT_LIST_PATH };

  /** 購物車狀態；每次異動後以 API 回應的內容（含金額摘要）取代 */
  private readonly cartState = injectCartState();
  /** 正在執行移除動畫、尚未真正從購物車移除的商品 ID */
  private leavingIds = signal<ReadonlySet<string>>(new Set());

  /** 購物車行清單，供 app-cart-line 逐行顯示；其餘統計數字皆由此換算 */
  protected lines = computed<CartLineData[]>(() => {
    const leavingIds = this.leavingIds();
    return (this.cartState.cart()?.items ?? []).map((item) => toCartLineData(item, leavingIds.has(item.productId)));
  });

  /** 購物車內容是否已載入 */
  protected loaded = computed(() => this.cartState.cart() !== null);
  /** 購物車是否含有商品 */
  protected hasItems = computed(() => this.lines().length > 0);
  /** 購物車件數，顯示於頁首與標題列 */
  protected count = this.cartState.count;
  /** ui-integration: 購物車異動失敗要留在原頁面並明確告知，不讓使用者誤以為已更新。 */
  protected error = this.cartState.error;

  /** 金額摘要（後端以預設配送方式試算），供 app-cart-summary 顯示 */
  protected amounts = computed(() => this.cartState.cart()?.amounts ?? null);

  /** 再加購商品清單（購物車內尚未加入的商品） */
  protected addons = computed(() => (this.cartState.cart()?.addons ?? []).map(toProductView));

  /** 變更某商品的購物車數量；數量減至 0 視同移除 */
  protected onQtyChange(id: string, qty: number): void {
    if (qty <= 0) {
      this.onRemove(id);
      return;
    }
    this.cartState.update(id, qty);
  }

  /** 移除購物車中的商品：先觸發離場動畫，動畫結束後才向 API 移除 */
  protected onRemove(id: string): void {
    this.leavingIds.update((ids) => new Set(ids).add(id));
    setTimeout(() => {
      this.cartState.remove(id, () =>
        this.leavingIds.update((ids) => {
          const next = new Set(ids);
          next.delete(id);
          return next;
        }),
      );
    }, REMOVE_ANIMATION_MS);
  }

  /** 將再加購商品加入購物車（數量 1） */
  protected onAddAddon(id: string): void {
    this.cartState.add(id);
  }
}
