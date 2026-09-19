import { computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { CartApi, MemberApi, SiteApi } from '../api';
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
  /** 最近一次寫入失敗；保留給未來既有頁面顯示，不以空資料假裝寫入成功。 */
  const error = signal<string | null>(null);

  /** 送出請求並以回應內容更新購物車，更新後執行 done */
  const apply = (request: Observable<ShoppingCart>, done?: () => void) =>
    request.subscribe({
      next: (value) => {
        error.set(null);
        cart.set(value);
        done?.();
      },
      error: () => {
        // integration: 寫入失敗時維持畫面上的上一份真實購物車，並結束移除動畫；
        // 明確接住 Observable 錯誤，避免 Angular 將單一商城操作升級成全域未處理例外。
        error.set('購物車目前無法更新，請稍後再試。');
        done?.();
      },
    });

  apply(cartApi.getCart());

  return {
    cart: cart.asReadonly(),
    error: error.asReadonly(),
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
  const memberApi = inject(MemberApi);
  const config = toSignal(inject(SiteApi).getConfig());
  const profile = toSignal(memberApi.getProfile());

  return {
    /** 全站設定，尚未載入時為 undefined */
    config,
    /** 頂部公告列的公告文字 */
    announcements: computed(() => config()?.promoAnnouncements ?? []),
    /** 頂部公告列顯示的會員點數 */
    points: computed(() => formatNumber(profile()?.pointBalance ?? 0)),
    /** 頂部公告列的折價券清單 */
    coupons: toSignal(memberApi.getCoupons(), { initialValue: [] }),
  };
}
