import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, switchMap, throwError } from 'rxjs';
import { meUrl } from './http';
import { CartItem, ShoppingCart } from './api.models';
import { toCatalogThumbnail, toCategoryLabel } from './catalog.api-dto';

interface ApiCartItem {
  id: string;
  productId: string;
  productName: string;
  categoryCode: string;
  primaryImagePath: string | null;
  unitPrice: number;
  originalPrice: number | null;
  quantity: number;
  availableStock: number;
  lineTotal: number;
  addedAt: string;
}

const MEMBER_CART_API = meUrl('/cart');

/** 空購物車；未登入或購物車 API 暫時無法使用時的顯示內容 */
export function emptyCart(): ShoppingCart {
  return toCart([]);
}

function toCart(dto: ApiCartItem[]): ShoppingCart {
  const items: CartItem[] = dto.map((item) => ({
    productId: item.productId,
    coverImage: toCatalogThumbnail(item.primaryImagePath),
    // 後端 CartItemDto 沒有品牌與規格欄位，以空字串補上，不在前端猜測商品資料。
    brand: '',
    category: toCategoryLabel(item.categoryCode),
    name: item.productName,
    dimensions: '',
    price: item.unitPrice,
    originalPrice: item.originalPrice,
    qty: item.quantity,
    lineTotal: item.lineTotal,
  }));
  // CartAmounts.subtotal 是折扣前小計；有折扣的品項以後端提供的 originalPrice 計算，差額即商品折扣。
  const subtotal = items.reduce((sum, item) => sum + (item.originalPrice ?? item.price) * item.qty, 0);
  const payable = items.reduce((sum, item) => sum + item.lineTotal, 0);
  return {
    items,
    amounts: {
      subtotal,
      // 金額可能含小數（後端 decimal），相減後修正浮點誤差。
      itemDiscount: Math.round((subtotal - payable) * 100) / 100,
      payable,
    },
  };
}

/** 購物車 API；異動類請求皆回傳異動後的完整購物車內容 */
@Injectable({ providedIn: 'root' })
export class CartApi {
  private readonly http = inject(HttpClient);

  private requestCart(): Observable<ShoppingCart> {
    return this.http.get<ApiCartItem[]>(MEMBER_CART_API).pipe(map(toCart));
  }

  /**
   * GET /me/cart：將 CartItemDto 陣列轉成商城頁面使用的購物車模型。
   * 401（未登入）保留錯誤，讓呼叫端據此判斷登入狀態；其他錯誤（資料庫暫時不可用等）只顯示空車，
   * 不讓 Store 首頁整頁中止。寫入操作則保留所有錯誤，不假裝成功。
   */
  getCart(): Observable<ShoppingCart> {
    return this.requestCart().pipe(
      catchError((err: unknown) =>
        err instanceof HttpErrorResponse && err.status === 401 ? throwError(() => err) : of(emptyCart()),
      ),
    );
  }

  /** POST /me/cart：加入商品；購物車已有同商品時累加數量，再重新取得完整購物車。 */
  addItem(productId: string, qty: number): Observable<ShoppingCart> {
    return this.http
      .post<ApiCartItem>(MEMBER_CART_API, { productId, quantity: qty })
      // 異動後重新讀取不能沿用 getCart 的空車降級；否則寫入已成功但重新讀取失敗時，
      // 畫面會誤以為購物車真的變成空車。
      .pipe(switchMap(() => this.requestCart()));
  }

  /** PUT /me/cart/{productId}：修改數量，再重新取得完整購物車。 */
  updateItem(productId: string, qty: number): Observable<ShoppingCart> {
    return this.http
      .put<ApiCartItem>(`${MEMBER_CART_API}/${encodeURIComponent(productId)}`, {
        productId,
        quantity: qty,
      })
      .pipe(switchMap(() => this.requestCart()));
  }

  /** DELETE /me/cart/{productId}：移除品項，再重新取得完整購物車。 */
  removeItem(productId: string): Observable<ShoppingCart> {
    return this.http
      .delete<void>(`${MEMBER_CART_API}/${encodeURIComponent(productId)}`)
      .pipe(switchMap(() => this.requestCart()));
  }
}
