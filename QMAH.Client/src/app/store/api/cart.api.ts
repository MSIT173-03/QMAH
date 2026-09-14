import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from './http';
import { ShoppingCart } from './api.models';

/** 購物車 API；異動類請求皆回傳異動後的完整購物車內容 */
@Injectable({ providedIn: 'root' })
export class CartApi {
  private readonly http = inject(HttpClient);

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
    return this.http.patch<ShoppingCart>(apiUrl(`/cart/items/${encodeURIComponent(productId)}`), {
      qty,
    });
  }

  /** DELETE /cart/items/{productId}：移除品項 */
  removeItem(productId: string): Observable<ShoppingCart> {
    return this.http.delete<ShoppingCart>(apiUrl(`/cart/items/${encodeURIComponent(productId)}`));
  }
}
