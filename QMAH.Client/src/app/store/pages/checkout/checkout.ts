import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, filter, switchMap } from 'rxjs';
import { SiteHeader, StepIndicator, Breadcrumb, BreadcrumbItem, PageTitleRow, SiteFooter } from '../../component';
import { CheckoutApi, MemberApi } from '../../api';
import { OrderQuoteRequest, OrderResult, Recipient } from '../../api/api.models';
import { CART_PATH, HOME_PATH } from '../../shared/paths';
import { RecipientForm } from './recipient-form/recipient-form';
import { DeliveryOptions } from './delivery-options/delivery-options';
import { CouponPicker } from './coupon-picker/coupon-picker';
import { PointPicker } from './point-picker/point-picker';
import { CheckoutSummary } from './checkout-summary/checkout-summary';
import {
  CHECKOUT_STEPS,
  CHECKOUT_STEP_INDEX,
  EMPTY_RECIPIENT,
  NO_COUPON,
  PointMode,
  RecipientField,
  isRecipientValid,
  requestedPoints,
  toRecipient,
} from './checkout.data';

/**
 * 結帳頁面。
 * 各面板皆為顯示元件，結帳過程的狀態（收件資訊、配送、付款、折價券、點數）統一由本頁面持有；
 * 選項變動時向後端試算訂單金額（POST /checkout/quote），各面板與訂單摘要只顯示試算結果，
 * 前端不自行計算任何金額。
 */
@Component({
  selector: 'app-checkout',
  host: { class: 'store-app' },
  imports: [
    SiteHeader,
    StepIndicator,
    Breadcrumb,
    PageTitleRow,
    SiteFooter,
    RecipientForm,
    DeliveryOptions,
    CouponPicker,
    PointPicker,
    CheckoutSummary,
  ],
  templateUrl: './checkout.html',
  styleUrls: [
    './checkout.scss',
  ],
})
export class Checkout {
  private readonly checkoutApi = inject(CheckoutApi);
  private readonly memberApi = inject(MemberApi);

  /** 頁首的結帳流程步驟 */
  protected readonly steps = CHECKOUT_STEPS;
  protected readonly stepIndex = CHECKOUT_STEP_INDEX;
  /** 麵包屑導覽項目 */
  protected readonly breadcrumbItems: BreadcrumbItem[] = [
    { label: '首頁', href: HOME_PATH },
    { label: '購物車', href: CART_PATH },
    { label: '結帳' },
  ];
  /** 頁面標題列右側連結（個人頁面尚未實作，暫用預留連結） */
  protected readonly profileLink = { label: '管理個人資料 →', href: '#' };

  /* ===============================
     API 資料
     =============================== */

  /** 配送／付款方式 */
  private readonly options = toSignal(this.checkoutApi.getOptions());
  /** 會員資料（帶入收件資訊、持有點數） */
  private readonly profile = toSignal(this.memberApi.getProfile());
  /** 會員可選用的折價券 */
  protected readonly coupons = toSignal(this.memberApi.getCoupons(), { initialValue: [] });
  /** 付款方式名稱 */
  protected payments = computed(() => this.options()?.paymentOptions.map((option) => option.name) ?? []);
  /** 會員持有點數 */
  protected pointBalance = computed(() => this.profile()?.pointBalance ?? 0);

  /* ===============================
     結帳過程狀態
     =============================== */

  /** 收件資訊表單內容 */
  protected form = signal<Recipient>({ ...EMPTY_RECIPIENT });
  /** 是否已按下「帶入個人資料」 */
  protected filled = signal(false);
  /** 選取的配送方式索引 */
  protected shipIndex = signal(0);
  /** 選取的付款方式索引 */
  protected payIndex = signal(0);
  /** 選用的折價券索引，NO_COUPON 代表未選用 */
  protected couponIndex = signal(NO_COUPON);
  /** 點數折抵方式 */
  protected pointMode = signal<PointMode>('none');
  /** 自訂折抵點數的輸入內容 */
  protected customPoints = signal('');
  /** 是否已按下確認下單 */
  protected submitted = signal(false);
  /** 訂單成立後的 API 回應，未成立時為 null */
  protected order = signal<OrderResult | null>(null);

  /* ===============================
     訂單金額試算（後端）
     =============================== */

  /** 目前選項對應的試算請求；選項尚未載入或訂單已成立（購物車已清空）時為 null，不再試算 */
  private quoteRequest = computed<OrderQuoteRequest | null>(() => {
    const options = this.options();
    if (!options || this.order()) return null;
    return {
      shippingOptionId: options.shippingOptions[this.shipIndex()].id,
      couponId: this.coupons()[this.couponIndex()]?.id ?? null,
      usePoints: requestedPoints(this.pointMode(), this.customPoints(), this.pointBalance()),
    };
  });

  /** 後端試算結果；選項變動時重新試算，試算失敗時保留上一次的結果 */
  protected quote = toSignal(
    toObservable(this.quoteRequest).pipe(
      filter((request): request is OrderQuoteRequest => request !== null),
      switchMap((request) => this.checkoutApi.getQuote(request).pipe(catchError(() => EMPTY))),
    ),
    { initialValue: null },
  );

  /** 選用的配送方式名稱，供訂單摘要的運費列顯示 */
  protected shipName = computed(() => this.options()?.shippingOptions[this.shipIndex()]?.name ?? '');

  /** 收件資訊必填欄位是否皆已填妥 */
  protected valid = computed(() => isRecipientValid(this.form()));

  /* ===============================
     使用者操作
     =============================== */

  /** 更新收件資訊的單一欄位 */
  protected onFieldChange({ field, value }: { field: RecipientField; value: string }): void {
    this.form.update((form) => ({ ...form, [field]: value }));
  }

  /** 以會員個人資料一次填妥收件資訊 */
  protected onFill(): void {
    const profile = this.profile();
    if (!profile) return;
    this.form.set(toRecipient(profile));
    this.filled.set(true);
  }

  /** 送出訂單；必填欄位未填妥時，由訂單摘要顯示補填提示 */
  protected onSubmit(): void {
    this.submitted.set(true);
    const options = this.options();
    const request = this.quoteRequest();
    if (!this.valid() || !options || !request) return;
    this.checkoutApi
      .createOrder({
        ...request,
        recipient: this.form(),
        paymentOptionId: options.paymentOptions[this.payIndex()].id,
      })
      .subscribe((order) => this.order.set(order));
  }
}
