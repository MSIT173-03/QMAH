import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, switchMap } from 'rxjs';
import { apiUrl, meUrl } from './http';
import {
  CheckoutOptions,
  Coupon,
  EcpayCheckoutForm,
  OrderQuote,
  OrderQuoteRequest,
  OrderRequest,
  OrderResult,
} from './api.models';

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
  shippingOptionId: string;
  paymentOptionId: string;
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
  shippingFee: number;
  totalAmount: number;
  /** 依應付總額即時換算，付款流程完成前尚未實際入帳 */
  pointsEarned: number;
  ecpayCheckout: EcpayCheckoutForm | null;
}

/** 結帳與訂單 API */
@Injectable({ providedIn: 'root' })
export class CheckoutApi {
  private readonly http = inject(HttpClient);

  /** GET /checkout/options：配送／付款方式、免運門檻與點數回饋比例；選項本身是後端固定的模擬目錄。 */
  getOptions(): Observable<CheckoutOptions> {
    return this.http.get<CheckoutOptions>(apiUrl('/checkout/options'));
  }

  /** POST /checkout/quote：依配送方式、折價券與點數試算訂單金額（不成立訂單，也不寫入任何資料）。 */
  getQuote(request: OrderQuoteRequest): Observable<OrderQuote> {
    return this.http.post<OrderQuote>(apiUrl('/checkout/quote'), request);
  }

  /**
   * POST /store/orders：以目前購物車內容送出訂單，回應中的金額（含運費、回饋點數）由後端重新計算。
   * 收件人信箱、統編與備註後端尚無對應欄位，目前只保留在前端表單，不會送出。
   *
   * 折抵上限由後端試算提供，保留既有呼叫參數相容性。
   */
  createOrder(order: OrderRequest, _coupon: Coupon | null): Observable<OrderResult> {
    const idempotencyKey = crypto.randomUUID();
    return this.http.get<ApiCartLine[]>(meUrl('/cart')).pipe(
      switchMap((cart) => this.getQuote({ shippingOptionId: order.shippingOptionId, couponId: order.couponId, usePoints: order.usePoints }).pipe(switchMap(quote => {
        const body: ApiCreateOrderRequest = {
          items: cart.map(({ productId, quantity }) => ({ productId, quantity })),
          idempotencyKey,
          userCouponId: order.couponId,
          // 使用後端試算的上限，不在前端複製折抵比例與金額規則。
          pointsUsed: Math.min(order.usePoints, quote.pointCap),
          recipientName: order.recipient.name.trim(),
          recipientPhone: order.recipient.phone.trim(),
          shippingPostalCode: order.recipient.postalCode.trim(),
          shippingCity: order.recipient.city.trim(),
          shippingDistrict: order.recipient.district.trim(),
          shippingAddressLine: order.recipient.address.trim(),
          shippingOptionId: order.shippingOptionId,
          paymentOptionId: order.paymentOptionId,
        };
        return this.http.post<ApiOrder>(apiUrl('/orders'), body);
      }))),
      map((dto) => ({
        orderId: dto.id,
        orderNo: dto.orderNo,
        subtotal: dto.subtotal,
        // 後端 OrderDto 的小計已是商品折扣後金額，商品折扣沒有另外的欄位可拆出來。
        itemDiscount: 0,
        shippingFee: dto.shippingFee,
        couponDiscount: dto.discountAmount,
        pointsUsed: dto.pointsUsed,
        payable: dto.totalAmount,
        pointsEarned: dto.pointsEarned,
        ecpayCheckout: dto.ecpayCheckout,
      })),
    );
  }
}
