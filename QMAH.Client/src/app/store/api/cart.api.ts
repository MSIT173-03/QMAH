import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CartItem, ShoppingCart } from './api.models';
import { toCatalogThumbnail } from './catalog.api-dto';

interface ApiCartItem {
  id: string;
  productId: string;
  productName: string;
  primaryImagePath: string | null;
  unitPrice: number;
  originalPrice: number | null;
  quantity: number;
  availableStock: number;
  lineTotal: number;
  addedAt: string;
}

const MEMBER_CART_API = `${environment.apiBaseUrl}/me/cart`;

function emptyCart(): ShoppingCart {
  return {
    items: [],
    addons: [],
    amounts: {
      subtotal: 0,
      itemDiscount: 0,
      shippingFee: 0,
      payable: 0,
      freeShippingThreshold: 0,
      freeShippingShortfall: 0,
    },
  };
}

function toCart(dto: ApiCartItem[]): ShoppingCart {
  const items: CartItem[] = dto.map((item) => ({
    productId: item.productId,
    coverImage: toCatalogThumbnail(item.primaryImagePath),
    // 後端 CartItemDto 沒有品牌與規格欄位；adapter 以中性值保留既有頁面契約，
    // 不在前端猜測商品資料，也不另外創造一組與資料庫不一致的商城 API。
    brand: '',
    category: '',
    name: item.productName,
    dimensions: '',
    price: item.unitPrice,
    originalPrice: item.originalPrice,
    qty: item.quantity,
    lineTotal: item.lineTotal,
  }));
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  return {
    items,
    addons: [],
    amounts: {
      subtotal,
      itemDiscount: 0,
      shippingFee: 0,
      payable: subtotal,
      freeShippingThreshold: 0,
      freeShippingShortfall: 0,
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

  /** GET /me/cart：將既有 CartItemDto 陣列轉成 Store 頁面既有模型。 */
  getCart(): Observable<ShoppingCart> {
    return this.requestCart().pipe(
      // 購物車是可選的會員區塊；未登入、資料庫暫時不可用或 route 尚未部署時只顯示空車，
      // 不讓 Store 首頁因 toSignal 收到錯誤而整頁中止。寫入操作則保留錯誤，不假裝成功。
      catchError(() => of(emptyCart())),
    );
  }

  /** POST /me/cart：加入或覆寫既有商品數量，再重新取得完整購物車。 */
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
