import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl, meUrl } from './http';
import { EcpayCheckoutForm, MyOrderPage } from './api.models';

/** 我的訂單 API */
@Injectable({ providedIn: 'root' })
export class OrdersApi {
  private readonly http = inject(HttpClient);

  /** GET /me/orders：目前會員的訂單，新到舊排序 */
  getMyOrders(page = 1): Observable<MyOrderPage> {
    return this.http.get<MyOrderPage>(meUrl('/orders'), { params: new HttpParams().set('page', page) });
  }

  /**
   * POST /store/orders/{id}/cancel：只允許待付款訂單，成功回 204。
   * 信用卡訂單取消前後端會先向綠界確認沒有付款；已付款回 409，無法確認時回 503。
   */
  cancelOrder(orderId: string): Observable<void> {
    return this.http.post<void>(apiUrl`/orders/${orderId}/cancel`, {});
  }

  /**
   * POST /store/orders/{id}/ecpay-checkout：為待付款的信用卡訂單產生新的綠界付款表單。
   * 綠界不允許重複的交易編號，每次前往付款都要重新取得，不能沿用訂單資料或舊的表單。
   */
  createEcpayCheckout(orderId: string): Observable<EcpayCheckoutForm> {
    return this.http.post<EcpayCheckoutForm>(apiUrl`/orders/${orderId}/ecpay-checkout`, {});
  }
}
