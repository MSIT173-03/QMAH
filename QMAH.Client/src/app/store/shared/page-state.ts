import { computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { CartApi, CatalogApi, SiteApi } from '../api';
import { ShoppingCart } from '../api/api.models';
import { formatNumber } from './format';

/**
 * 頁面持有的購物車狀態：建立時向 API 取得一次購物車，之後每次異動皆以 API 回應的內容取代。
 * 須於注入環境中呼叫（例如元件欄位初始化），各頁面各自持有一份。
 */
export function injectCartState() {
  const cartApi = inject(CartApi);
  /** 購物車內容；null 代表尚在載入 */
  const cart = signal<ShoppingCart | null>(null);

  /** 送出請求並以回應內容更新購物車，更新後執行 done */
  const apply = (request: Observable<ShoppingCart>, done?: () => void) =>
    request.subscribe((value) => {
      cart.set(value);
      done?.();
    });

  apply(cartApi.getCart());

  return {
    cart: cart.asReadonly(),
    /** 購物車內商品件數 */
    count: computed(() => cart()?.items.reduce((sum, item) => sum + item.qty, 0) ?? 0),
    /** 加入購物車（預設數量 1） */
    add: (productId: string, qty = 1, done?: () => void) => apply(cartApi.addItem(productId, qty), done),
    /** 修改購物車內商品數量 */
    update: (productId: string, qty: number) => apply(cartApi.updateItem(productId, qty)),
    /** 移除購物車內商品 */
    remove: (productId: string, done?: () => void) => apply(cartApi.removeItem(productId), done),
  };
}

/**
 * 全站共用資料：全站設定，以及頂部公告列所需的公告文字、會員點數與折價券。
 * 須於注入環境中呼叫（例如元件欄位初始化）。
 */
export function injectSiteData() {
  const config = toSignal(inject(SiteApi).getConfig());
  const info = toSignal(inject(CatalogApi).getProductInfo());

  return {
    /** 全站設定，尚未載入時為 undefined */
    config,
    /** 商品資訊（器類數量、會員點數與折價券、各排行榜），尚未載入時為 undefined */
    info,
    /** 頂部公告列的公告文字 */
    announcements: computed(() => config()?.promoAnnouncements ?? []),
    /** 是否已登入；資料載入前視為未登入，避免登入狀態不明時露出會員專屬連結 */
    isLoggedIn: computed(() => info()?.isLoggedIn ?? false),
    /** 頂部公告列顯示的會員點數 */
    points: computed(() => formatNumber(info()?.pointBalance ?? 0)),
    /** 頂部公告列的折價券清單 */
    coupons: computed(() => info()?.coupons ?? []),
  };
}
