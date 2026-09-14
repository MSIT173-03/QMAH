import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from './http';
import { CheckoutOptions, OrderQuote, OrderQuoteRequest, OrderRequest, OrderResult } from './api.models';

/** 結帳與訂單 API */
@Injectable({ providedIn: 'root' })
export class CheckoutApi {
  private readonly http = inject(HttpClient);

  /** GET /checkout/options：配送／付款方式、免運門檻與點數回饋比例 */
  getOptions(): Observable<CheckoutOptions> {
    return this.http.get<CheckoutOptions>(apiUrl('/checkout/options'));
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
