import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { CheckoutApi } from '../api';
import { StoreAuth } from './store-auth';

/**
 * 目前登入會員購買過的商品（訂單不是待付款或已取消；不重複的商品編號）。
 * 確認登入後查詢一次並保存；之後不會重複查詢，登出後清除，下次登入再查詢。
 * 首頁、商品列表與商品頁進入時呼叫 ensureLoaded()：沒有資料才查詢並保存，已有資料不會重複查詢。
 */
@Injectable({ providedIn: 'root' })
export class PurchasedProducts {
  private readonly auth = inject(StoreAuth);
  private readonly checkoutApi = inject(CheckoutApi);

  /** 已購買的商品編號（小寫）；null 代表尚未查詢（未登入、尚未確認登入狀態或查詢中） */
  private readonly ids = signal<ReadonlySet<string> | null>(null);
  /** 本次登入是否已發出查詢 */
  private requested = false;
  private request: Subscription | null = null;

  constructor() {
    effect(() => {
      const status = this.auth.status();
      untracked(() => {
        if (status === 'authenticated') this.load();
        else if (status === 'anonymous') this.reset();
      });
    });
  }

  /** 進入頁面時呼叫：已登入且還沒有資料（沒查過，或上次查詢失敗）就查詢並保存；已有資料或查詢中不會重複查詢 */
  ensureLoaded(): void {
    if (this.auth.status() === 'authenticated') this.load();
  }

  /** 是否購買過這項商品；尚未查詢完成時為 false */
  has(productId: string): boolean {
    return this.ids()?.has(productId.toLowerCase()) ?? false;
  }

  private load(): void {
    if (this.requested) return;
    this.requested = true;
    this.request = this.checkoutApi.getPurchasedProductIds().subscribe({
      next: (ids) => this.ids.set(new Set(ids.map((id) => id.toLowerCase()))),
      // 查詢失敗只是暫時無法評價；下次登入狀態改變時會再查詢。
      error: () => (this.requested = false),
    });
  }

  /** 登出：清除結果，並取消還在途中的查詢，避免舊帳號的結果寫進來 */
  private reset(): void {
    this.request?.unsubscribe();
    this.request = null;
    this.requested = false;
    this.ids.set(null);
  }
}
