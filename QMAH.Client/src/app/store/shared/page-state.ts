import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { StoreAuth } from './store-auth';
import { CartApi, CatalogApi, MemberApi, SiteApi } from '../api';
import { ShoppingCart } from '../api/api.models';
import { emptyCart } from '../api/cart.api';
import { formatNumber } from './format';
import { loginPath } from './paths';

/** 購物車請求完成後的回呼 */
interface CartCallbacks {
  /** 請求成功、購物車已更新後執行（例如「加入並查看購物車」的導覽） */
  success?: () => void;
  /** 請求結束後一律執行，不論成功、失敗或因未登入而未送出（例如結束移除動畫） */
  settled?: () => void;
}

/**
 * 頁面持有的購物車狀態：建立時向 API 取得一次購物車，之後每次異動皆以 API 回應的內容取代。
 * 登入狀態由 StoreAuth（以 AuthService 驗證）判斷：未登入時不送出購物車請求，寫入操作改為開啟登入提示，
 * 由使用者決定是否前往登入頁（loginPrompt／confirmLogin／cancelLogin，搭配 app-login-prompt 顯示）。
 * 須於注入環境中呼叫（例如元件欄位初始化），各頁面各自持有一份。
 */
export function injectCartState() {
  const cartApi = inject(CartApi);
  const auth = inject(StoreAuth);
  const router = inject(Router);
  /** 購物車內容；null 代表尚在載入 */
  const cart = signal<ShoppingCart | null>(null);
  /** 最近一次寫入失敗；由購物車頁直接呈現，不以空資料假裝寫入成功。 */
  const error = signal<string | null>(null);
  /** 是否顯示登入提示 */
  const loginPrompt = signal(false);

  /** 送出請求並以回應內容更新購物車 */
  const apply = (request: Observable<ShoppingCart>, isWrite: boolean, callbacks: CartCallbacks = {}) =>
    request.subscribe({
      next: (value) => {
        error.set(null);
        cart.set(value);
        callbacks.success?.();
        callbacks.settled?.();
      },
      error: (err: unknown) => {
        callbacks.settled?.();
        if (err instanceof HttpErrorResponse && err.status === 401) {
          // 登入已失效（例如 cookie 過期）：同步清除全站登入狀態，寫入操作改為詢問是否重新登入。
          auth.markSignedOut();
          cart.set(emptyCart());
          if (isWrite) loginPrompt.set(true);
          return;
        }
        // integration: 寫入失敗時維持畫面上的上一份真實購物車，並結束移除動畫；
        // 明確接住 Observable 錯誤，避免 Angular 將單一商城操作升級成全域未處理例外。
        error.set('購物車目前無法更新，請稍後再試。');
      },
    });

  /** 確認登入狀態後才送出寫入請求；未登入時不送出注定 401 的請求，改為開啟登入提示 */
  const write = (request: () => Observable<ShoppingCart>, callbacks: CartCallbacks = {}) =>
    auth.ensureLoaded().subscribe(() => {
      if (auth.status() === 'anonymous') {
        callbacks.settled?.();
        loginPrompt.set(true);
        return;
      }
      apply(request(), true, callbacks);
    });

  // 未登入時直接顯示空購物車，不送出 GET /me/cart。
  auth.ensureLoaded().subscribe(() => {
    if (auth.status() === 'anonymous') cart.set(emptyCart());
    else apply(cartApi.getCart(), false);
  });

  return {
    cart: cart.asReadonly(),
    error: error.asReadonly(),
    /** 是否已登入：null 代表尚未確認 */
    signedIn: computed(() => {
      const status = auth.status();
      return status === 'unknown' ? null : status === 'authenticated';
    }),
    /** 是否顯示登入提示 */
    loginPrompt: loginPrompt.asReadonly(),
    /** 登入提示按下「前往登入」：導向登入頁，登入後回到目前頁面 */
    confirmLogin: () => {
      loginPrompt.set(false);
      router.navigateByUrl(loginPath(router.url));
    },
    /** 登入提示按下「取消」：留在目前頁面 */
    cancelLogin: () => loginPrompt.set(false),
    /** 購物車內商品件數 */
    count: computed(() => cart()?.items.reduce((sum, item) => sum + item.qty, 0) ?? 0),
    /** 加入購物車（預設數量 1）；成功後執行 done，未登入時改為開啟登入提示 */
    add: (productId: string, qty = 1, done?: () => void) =>
      write(() => cartApi.addItem(productId, qty), { success: done }),
    /** 修改購物車內商品數量 */
    update: (productId: string, qty: number) => write(() => cartApi.updateItem(productId, qty)),
    /** 移除購物車內商品；不論成功與否皆執行 done（用於結束移除動畫） */
    remove: (productId: string, done?: () => void) =>
      write(() => cartApi.removeItem(productId), { settled: done }),
  };
}

/**
 * 全站共用資料：全站設定，以及頂部公告列所需的公告文字、會員點數與折價券。
 * 須於注入環境中呼叫（例如元件欄位初始化）。
 */
export function injectSiteData() {
  const memberApi = inject(MemberApi);
  const config = toSignal(inject(SiteApi).getConfig());
  const promotions = toSignal(inject(CatalogApi).getPromotions(), { initialValue: [] });
  const profile = toSignal(memberApi.getProfile());

  return {
    /** 全站設定，尚未載入時為 undefined */
    config,
    /** 頂部公告列的公告文字：官方商城優惠活動標題在前，全站設定公告在後 */
    announcements: computed(() => [
      ...promotions().map((promotion) => promotion.title),
      ...(config()?.promoAnnouncements ?? []),
    ]),
    /** 頂部公告列顯示的會員點數 */
    points: computed(() => formatNumber(profile()?.pointBalance ?? 0)),
    /** 頂部公告列的折價券清單 */
    coupons: toSignal(memberApi.getCoupons(), { initialValue: [] }),
  };
}
