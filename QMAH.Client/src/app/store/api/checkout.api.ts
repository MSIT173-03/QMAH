import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { apiUrl } from './http';
import { CheckoutOptions, Coupon, OrderQuote, OrderQuoteRequest, OrderRequest, OrderResult } from './api.models';

const DISABLED_CHECKOUT_OPTIONS: CheckoutOptions = {
  shippingOptions: [],
  paymentOptions: [],
  freeShippingThreshold: 0,
  pointEarnRate: 0,
};

/** GET /me/cart 項目中下單用得到的欄位 */
interface ApiCartLine {
  productId: string;
  quantity: number;
  /** 折扣後單價 × 數量，與後端訂單小計使用同一個 EffectivePrice 規則 */
  lineTotal: number;
}

/** POST /store/orders 請求（後端 CreateStoreOrderRequest） */
interface ApiCreateOrderRequest {
  items: { productId: string; quantity: number }[];
  /** 同一次下單安全重送用的識別，避免重複扣庫存與點數 */
  idempotencyKey: string;
  userCouponId: string | null;
  pointsUsed: number;
  recipientName: string;
  recipientPhone: string;
  shippingPostalCode: string;
  shippingCity: string;
  shippingDistrict: string;
  shippingAddressLine: string;
}

/** POST /store/orders 回應（後端 OrderDto 中前端用得到的欄位） */
interface ApiOrder {
  id: string;
  orderNo: string;
  status: string;
  /** 商品小計（已套用商品折扣後的單價計算） */
  subtotal: number;
  /** 折價券折抵金額 */
  discountAmount: number;
  pointsUsed: number;
  totalAmount: number;
}

/**
 * 本次訂單可折抵的點數上限（1 點折抵 1 元），依後端 StoreOrdersController 的規則：
 * 點數只能折抵「商品小計 − 折價券折抵」，折價券折抵金額不超過小計。
 * 未達折價券門檻時後端會直接拒絕該券，這裡不另行處理。
 */
function pointCap(subtotal: number, coupon: Coupon | null): number {
  let discount = 0;
  if (coupon?.kind === 'percent') discount = Math.round(subtotal * coupon.value * 100) / 100;
  else if (coupon?.kind === 'amount') discount = coupon.value;
  return Math.max(0, Math.floor(subtotal - Math.min(discount, subtotal)));
}

/** 結帳與訂單 API */
@Injectable({ providedIn: 'root' })
export class CheckoutApi {
  private readonly http = inject(HttpClient);

  // integration: 正式後端目前只有 /store/orders 的既有契約；配送試算與 payment callback 尚未完成，
  // 因此未定義的 options 只回傳停用狀態，不對不存在的 route 送出請求。

  /**
   * GET /checkout/options：配送／付款方式、免運門檻與點數回饋比例。
   *
   * develop 目前沒有正式的 options／quote route；先回傳空選項讓既有頁面停用，
   * 不向不存在的 endpoint 發 request，也不以本機假資料假裝能付款。待商城負責人定義正式 DTO 後再接回 HTTP。
   */
  getOptions(): Observable<CheckoutOptions> {
    return of(DISABLED_CHECKOUT_OPTIONS);
  }

  /** POST /checkout/quote：依配送方式、折價券與點數試算訂單金額（不成立訂單）；後端尚未提供此 route。 */
  getQuote(request: OrderQuoteRequest): Observable<OrderQuote> {
    return this.http.post<OrderQuote>(apiUrl('/checkout/quote'), request);
  }

  /**
   * POST /store/orders：以目前購物車內容送出訂單，回應中的金額由後端重新計算。
   * 後端尚無配送與付款方式欄位，shippingOptionId／paymentOptionId 不送出；
   * 收件人信箱、統編與備註也沒有對應欄位，目前只保留在前端表單。
   *
   * @param coupon 選用的折價券（需與 order.couponId 相同），用來估算點數可折抵上限
   */
  createOrder(order: OrderRequest, coupon: Coupon | null): Observable<OrderResult> {
    const idempotencyKey = crypto.randomUUID();
    return this.http.get<ApiCartLine[]>(`${environment.apiBaseUrl}/me/cart`).pipe(
      switchMap((cart) => {
        const subtotal = cart.reduce((sum, line) => sum + line.lineTotal, 0);
        const body: ApiCreateOrderRequest = {
          items: cart.map(({ productId, quantity }) => ({ productId, quantity })),
          idempotencyKey,
          userCouponId: order.couponId,
          // 後端不夾限點數，超過「折價券折抵後小計」會直接回 400；送出前先夾在可折抵上限內。
          pointsUsed: Math.min(order.usePoints, pointCap(subtotal, coupon)),
          recipientName: order.recipient.name.trim(),
          recipientPhone: order.recipient.phone.trim(),
          shippingPostalCode: order.recipient.postalCode.trim(),
          shippingCity: order.recipient.city.trim(),
          shippingDistrict: order.recipient.district.trim(),
          shippingAddressLine: order.recipient.address.trim(),
        };
        return this.http.post<ApiOrder>(apiUrl('/orders'), body);
      }),
      map((dto) => ({
        orderId: dto.id,
        subtotal: dto.subtotal,
        // 後端 OrderDto 的小計已是商品折扣後金額，也沒有運費與點數回饋欄位。
        itemDiscount: 0,
        shippingFee: 0,
        couponDiscount: dto.discountAmount,
        pointsUsed: dto.pointsUsed,
        payable: dto.totalAmount,
        pointsEarned: 0,
      })),
    );
  }
}
