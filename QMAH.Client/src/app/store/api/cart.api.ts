import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
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

const MEMBER_CART_API = `${environment.apiBaseUrl}/me/cart`;

/** 空購物車；未登入或購物車 API 暫時無法使用時的顯示內容 */
export function emptyCart(): ShoppingCart {
  return toCart([]);
}

function toCart(dto: ApiCartItem[]): ShoppingCart {
  const items: CartItem[] = dto.map((item) => ({
    productId: item.productId,
    coverImage: toCatalogThumbnail(item.primaryImagePath),
    // 後端 CartItemDto 沒有品牌與規格欄位；adapter 以中性值保留既有頁面契約，
    // 不在前端猜測商品資料，也不另外創造一組與資料庫不一致的商城 API。
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
      // 後端尚無配送規則（運費、免運門檻），以 null 表示「結帳時計算」，不以 0 假裝免運。
      shippingFee: null,
      payable,
      freeShippingThreshold: null,
      freeShippingShortfall: null,
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

  // integration: develop 已有可用的正式購物車是 /me/cart；此處只做前端 adapter，
  // 不新增 compatibility endpoint，也不讓尚未定義的 Store contract 進入正式 runtime。

  /**
   * GET /me/cart：將既有 CartItemDto 陣列轉成 Store 頁面既有模型。
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
      // integration: 異動成功後的 refresh 不能沿用初始化 GET 的空車 fallback；
      // 否則寫入已成功但重新讀取失敗時，畫面會誤以為購物車真的變成空車。
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
