import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { apiUrl } from './http';
import { CheckoutOptions, OrderQuote, OrderQuoteRequest, OrderRequest, OrderResult } from './api.models';

const DISABLED_CHECKOUT_OPTIONS: CheckoutOptions = {
  shippingOptions: [],
  paymentOptions: [],
  freeShippingThreshold: 0,
  pointEarnRate: 0,
};

/** 結帳與訂單 API */
@Injectable({ providedIn: 'root' })
export class CheckoutApi {
  private readonly http = inject(HttpClient);

  // integration: 這組 checkout contract 目前仍是 Store branch 的 UI／mock contract；
  // 正式後端已整合的是 /store/orders 的 CreateStoreOrderRequest，配送試算與 payment callback 尚未完成，
  // 因此不能把 provideMockApi 放回 app.config 來掩蓋差異，需由商城負責人確認後再收斂 DTO。

  /**
   * GET /checkout/options：配送／付款方式、免運門檻與點數回饋比例。
   *
   * develop 目前沒有正式的 options／quote route；先回傳空選項讓既有頁面停用，
   * 不向不存在的 endpoint 發 request，也不使用 mock 假裝能付款。待商城負責人定義正式 DTO 後再接回 HTTP。
   */
  getOptions(): Observable<CheckoutOptions> {
    return of(DISABLED_CHECKOUT_OPTIONS);
  }

  /** POST /checkout/quote：依配送方式、折價券與點數試算訂單金額（不成立訂單） */
  getQuote(request: OrderQuoteRequest): Observable<OrderQuote> {
    return this.http.post<OrderQuote>(apiUrl('/checkout/quote'), request);
  }

  /** POST /orders：送出訂單，回應中的金額由後端重新計算 */
  createOrder(order: OrderRequest): Observable<OrderResult> {
    return this.http.post<OrderResult>(apiUrl('/orders'), order);
  }
}
