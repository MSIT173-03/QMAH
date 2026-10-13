import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { EMPTY, catchError, distinctUntilChanged, filter, finalize, switchMap } from 'rxjs';
import {
  SiteHeader,
  StepIndicator,
  Breadcrumb,
  BreadcrumbItem,
  PageTitleRow,
  OrderPlacedDialog,
} from '../../component';
import { CheckoutApi, MemberApi } from '../../api';
import { OrderQuoteRequest, OrderResult, Recipient } from '../../api/api.models';
import { EMPTY_RECIPIENT } from '../../api/member.api';
import { CART_PATH, CHECKOUT_PATH, HOME_PATH, MEMBER_PATH, PRODUCT_LIST_PATH, loginPath } from '../../shared/paths';
import { problemDetail } from '../../shared/problem-detail';
import { StoreAuth } from '../../shared/store-auth';
import { RecipientForm } from './recipient-form/recipient-form';
import { DeliveryOptions } from './delivery-options/delivery-options';
import { CouponPicker } from './coupon-picker/coupon-picker';
import { PointPicker } from './point-picker/point-picker';
import { CheckoutSummary } from './checkout-summary/checkout-summary';
import { ScrollTop } from '../../component/scroll-top/scroll-top';
import {
  CHECKOUT_STEPS,
  CHECKOUT_STEP_INDEX,
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
 * 選項變動時向後端試算訂單金額（POST /store/checkout/quote），各面板與訂單摘要只顯示試算結果，
 * 前端不自行計算任何金額。
 */
@Component({
  selector: 'app-checkout',
  host: { class: 'store-app' },
  imports: [ScrollTop, 
    SiteHeader,
    StepIndicator,
    Breadcrumb,
    PageTitleRow,
    RecipientForm,
    DeliveryOptions,
    CouponPicker,
    PointPicker,
    CheckoutSummary,
    OrderPlacedDialog,
  ],
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss',
})
export class Checkout {
  private readonly checkoutApi = inject(CheckoutApi);
  private readonly memberApi = inject(MemberApi);
  private readonly router = inject(Router);
  private readonly auth = inject(StoreAuth);

  /** 頁首的結帳流程步驟 */
  protected readonly steps = CHECKOUT_STEPS;
  protected readonly stepIndex = CHECKOUT_STEP_INDEX;
  /** 麵包屑導覽項目 */
  protected readonly breadcrumbItems: BreadcrumbItem[] = [
    { label: '首頁', href: HOME_PATH },
    { label: '購物車', href: CART_PATH },
    { label: '結帳' },
  ];
  /** 頁面標題列右側連結：前往會員個人頁面 */
  protected readonly profileLink = { label: '管理個人資料 →', href: MEMBER_PATH };

  /* ===============================
     API 資料
     =============================== */

  /** 配送／付款方式 */
  private readonly options = toSignal(this.checkoutApi.getOptions());
  /** 可用的配送／付款方式；尚未載入，或配送、付款任一清單為空時為 null（此時不試算也不下單） */
  private readonly enabledOptions = computed(() => {
    const options = this.options();
    return options && options.shippingOptions.length > 0 && options.paymentOptions.length > 0 ? options : null;
  });
  /** 會員資料（帶入收件資訊、持有點數） */
  private readonly profile = toSignal(this.memberApi.getCheckoutProfile());
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
  /** 訂單送出中（請求尚未回應）；期間不再送出第二次 */
  protected submitting = signal(false);
  /** 訂單送出失敗的說明；沒有錯誤時為 null */
  protected submitError = signal<string | null>(null);
  /** 同一次結帳安全重送用的識別：失敗後重送沿用同一把，訂單成立後才換新 */
  private idempotencyKey = crypto.randomUUID();
  /** 遞增即強制重新試算（選項沒變時也重送），下單被後端拒絕後使用 */
  private readonly quoteRefresh = signal(0);
  /** 訂單成立後的 API 回應，未成立時為 null */
  protected order = signal<OrderResult | null>(null);
  /** 訂單送出成功提示是否顯示；跟 order() 是否成立同步 */
  protected orderPlacedOpen = computed(() => this.order() !== null);
  /** 選用的折價券，未選用時為 null */
  private readonly selectedCoupon = computed(() => this.coupons()[this.couponIndex()] ?? null);

  /* ===============================
     訂單金額試算（後端）
     =============================== */

  /** 目前選項對應的試算請求；選項尚未載入或訂單已成立（購物車已清空）時為 null，不再試算 */
  private quoteRequest = computed<OrderQuoteRequest | null>(() => {
    const options = this.enabledOptions();
    if (!options || this.order()) return null;
    return {
      shippingOptionId: options.shippingOptions[this.shipIndex()].id,
      couponId: this.selectedCoupon()?.id ?? null,
      usePoints: requestedPoints(this.pointMode(), this.customPoints(), this.pointBalance()),
    };
  });

  /** 後端試算結果；選項變動時重新試算，試算失敗時保留上一次的結果 */
  protected quote = toSignal(
    toObservable(
      computed(() => {
        const request = this.quoteRequest();
        return request ? { request, refresh: this.quoteRefresh() } : null;
      }),
    ).pipe(
      filter((trigger): trigger is { request: OrderQuoteRequest; refresh: number } => trigger !== null),
      // quoteRequest 每次重算都是新物件（例如會員點數載入後），內容沒變就不重送，
      // 否則 switchMap 會取消還在途中的相同請求，API 端就會收到被中止的請求。
      distinctUntilChanged(
        (previous, current) =>
          previous.refresh === current.refresh &&
          previous.request.shippingOptionId === current.request.shippingOptionId &&
          previous.request.couponId === current.request.couponId &&
          previous.request.usePoints === current.request.usePoints,
      ),
      switchMap(({ request }) => this.checkoutApi.getQuote(request).pipe(catchError(() => EMPTY))),
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
    const options = this.enabledOptions();
    if (!options) return;
    this.submitted.set(true);
    const request = this.quoteRequest();
    const quote = this.quote();
    // 試算尚未取得時不送出：下單商品就是畫面上的試算明細。
    if (!this.valid() || !request || !quote || this.submitting()) return;

    this.submitting.set(true);
    this.submitError.set(null);
    this.checkoutApi
      .createOrder(
        {
          ...request,
          recipient: this.form(),
          paymentOptionId: options.paymentOptions[this.payIndex()].id,
        },
        quote,
        this.idempotencyKey,
      )
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (order) => {
          this.order.set(order);
          this.idempotencyKey = crypto.randomUUID();
        },
        error: (error: unknown) => {
          const status = error instanceof HttpErrorResponse ? error.status : 0;
          if (status === 401) {
            // 登入已失效：清除登入狀態並導向登入頁，登入後回到結帳頁。
            this.auth.markSignedOut();
            this.router.navigateByUrl(loginPath(CHECKOUT_PATH));
            return;
          }
          this.submitError.set(problemDetail(error, '訂單目前無法送出，請稍後再試。'));
          // 後端明確拒絕（4xx）時訂單沒有成立，重新試算讓金額反映庫存或優惠券的最新狀態。
          // 連線中斷或 5xx 時訂單可能其實已成立（購物車已清空），保留原試算，
          // 重送才會帶同樣的商品與同一把 key，讓後端找回原訂單。
          if (status >= 400 && status < 500) this.quoteRefresh.update((count) => count + 1);
        },
      });
  }

  /** 訂單送出成功提示唯一的出路：回到商品列表 */
  protected onReturnToProducts(): void {
    this.router.navigateByUrl(PRODUCT_LIST_PATH);
  }
}
