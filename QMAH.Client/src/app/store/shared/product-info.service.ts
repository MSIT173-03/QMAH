import { Injectable, computed, inject, signal } from '@angular/core';
import { CatalogApi } from '../api';
import { ProductInfo } from '../api/api.models';

/**
 * 商品資訊（products/info）的共用儲存：各器類數量與封面圖、登入狀態、會員點數與折價券，以及熱銷、新品與評價排行。
 * 頁面進入時呼叫 load()：已有資料就沿用，尚無資料才向 API 請求（請求進行中不重複送出）；
 * 登入狀態或會員資料可能已改變時（例如登入、登出、下單後）呼叫 refresh() 強制重新取得。
 */
@Injectable({ providedIn: 'root' })
export class ProductInfoService {
  private readonly catalogApi = inject(CatalogApi);

  private readonly state = signal<ProductInfo | null>(null);
  private requesting = false;

  /** 已保存的商品資訊，尚未取得時為 null */
  readonly info = this.state.asReadonly();

  /** 是否已登入；資料尚未取得前視為未登入 */
  readonly isLoggedIn = computed(() => this.state()?.isLoggedIn ?? false);

  /** 確保已有資料：已保存則直接沿用，否則請求一次 */
  load(): void {
    if (this.state() === null) this.request();
  }

  /** 略過已保存的資料，重新向 API 請求並取代 */
  refresh(): void {
    this.request();
  }

  private request(): void {
    if (this.requesting) return;
    this.requesting = true;
    this.catalogApi.getProductInfo().subscribe({
      next: (info) => {
        this.requesting = false;
        this.state.set(info);
      },
      // 失敗時不保存任何內容，下次進入頁面時會再次請求。
      error: () => (this.requesting = false),
    });
  }
}
