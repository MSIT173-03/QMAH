import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from './http';
import { ShoppingCart } from './api.models';

/** 購物車 API；異動類請求皆回傳異動後的完整購物車內容 */
@Injectable({ providedIn: 'root' })
export class CartApi {
  private readonly http = inject(HttpClient);

  // integration: 目前這裡仍是 Store UI 的 /store/cart contract；develop 的既有購物車 route 是 /me/cart，
  // DTO 也不同，待商城負責人確認要採 adapter 還是補 compatibility endpoint 後再接通，避免默默送錯格式。

  /** GET /cart：目前購物車內容 */
  getCart(): Observable<ShoppingCart> {
    return this.http.get<ShoppingCart>(apiUrl('/cart'));
  }

  /** POST /cart/items：加入購物車（已在購物車內則累加數量） */
  addItem(productId: string, qty: number): Observable<ShoppingCart> {
    return this.http.post<ShoppingCart>(apiUrl('/cart/items'), { productId, qty });
  }

  /** PATCH /cart/items/{productId}：修改數量 */
  updateItem(productId: string, qty: number): Observable<ShoppingCart> {
    return this.http.patch<ShoppingCart>(apiUrl`/cart/items/${productId}`, { qty });
  }

  /** DELETE /cart/items/{productId}：移除品項 */
  removeItem(productId: string): Observable<ShoppingCart> {
    return this.http.delete<ShoppingCart>(apiUrl`/cart/items/${productId}`);
  }
}
