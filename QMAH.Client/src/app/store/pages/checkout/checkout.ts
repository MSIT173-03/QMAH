import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { SiteHeader } from '../../component/site-header/site-header';
import { StepIndicator } from '../../component/step-indicator/step-indicator';
import { Breadcrumb, BreadcrumbItem } from '../../component/breadcrumb/breadcrumb';
import { PageTitleRow } from '../../component/page-title-row/page-title-row';
import { SiteFooter } from '../../component/site-footer/site-footer';
import { RecipientForm } from './recipient-form/recipient-form';
import { DeliveryOptions } from './delivery-options/delivery-options';
import { CouponPicker } from './coupon-picker/coupon-picker';
import { PointPicker } from './point-picker/point-picker';
import { CheckoutSummary } from './checkout-summary/checkout-summary';
import { CartApi } from '../../api/cart.api';
import { CheckoutApi } from '../../api/checkout.api';
import { MemberApi } from '../../api/member.api';
import { OrderResult } from '../../api/api.models';
import {
  CHECKOUT_STEPS,
  CHECKOUT_STEP_INDEX,
  CheckoutForm,
  CheckoutFormField,
  EMPTY_CHECKOUT_FORM,
  NO_COUPON,
  PointMode,
  couponDiscount,
  couponFreesShipping,
  formToRecipient,
  isCheckoutFormValid,
  pointCap,
  profileToForm,
  resolveUsedPoints,
  sumPayable,
  toCheckoutLineData,
} from './checkout.data';
import { CART_PATH, HOME_PATH } from '../../shared/paths';

/**
 * 結帳頁面。
 * 各面板皆為顯示元件，結帳過程的狀態（收件資訊、配送、付款、折價券、點數）
 * 統一由本頁面持有，並在此試算各子元件無法自行推導的跨區塊金額（運費與折抵）；
 * 送出訂單時由後端重新計算，試算結果僅供下單前預覽。
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

  /** 購物車內容（訂單商品） */
  private readonly cart = toSignal(inject(CartApi).getCart());
  /** 配送／付款方式、免運門檻與點數回饋比例 */
  private readonly options = toSignal(this.checkoutApi.getOptions());
  /** 會員資料（帶入收件資訊、持有點數） */
  private readonly profile = toSignal(this.memberApi.getProfile());
  /** 會員可選用的折價券 */
  protected readonly coupons = toSignal(this.memberApi.getCoupons(), { initialValue: [] });
  /** 付款方式名稱 */
  protected payments = computed(() => this.options()?.paymentOptions.map((option) => option.name) ?? []);
  /** 會員持有點數 */
  protected pointBalance = computed(() => this.profile()?.pointBalance ?? 0);
  /** 訂單完成後回饋的點數比例 */
  protected earnRate = computed(() => this.options()?.pointEarnRate ?? 0);

  /* ===============================
     結帳過程狀態
     =============================== */

  /** 收件資訊表單內容 */
  protected form = signal<CheckoutForm>({ ...EMPTY_CHECKOUT_FORM });
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
     訂單金額試算
     =============================== */

  /** 訂單商品行，由購物車內容換算而成 */
  protected lines = computed(() => (this.cart()?.items ?? []).map(toCheckoutLineData));

  /** 應付商品金額（折扣後），免運門檻、折價券門檻與點數上限皆以此為準 */
  protected payable = computed(() => sumPayable(this.lines()));

  /** 各配送方式在本次訂單適用的運費：達免運門檻時一律免運 */
  protected shippings = computed(() => {
    const options = this.options();
    if (!options) return [];
    const free = this.payable() >= options.freeShippingThreshold;
    return options.shippingOptions.map((option) => ({ ...option, fee: free ? 0 : option.fee }));
  });

  /** 目前選用的折價券，未選用時為 null */
  private coupon = computed(() =>
    this.couponIndex() === NO_COUPON ? null : (this.coupons()[this.couponIndex()] ?? null),
  );

  /** 折價券折抵金額 */
  protected couponCut = computed(() => couponDiscount(this.coupon(), this.payable()));

  /** 選用的配送方式，選項尚未載入時為 null */
  private shipping = computed(() => this.shippings()[this.shipIndex()] ?? null);

  /** 本次運費：選用免運券時一律為 0 */
  protected shipFee = computed(() => {
    const shipping = this.shipping();
    return !shipping || couponFreesShipping(this.coupon(), this.payable()) ? 0 : shipping.fee;
  });

  /** 點數折抵金額（與 app-point-picker 共用同一組換算規則） */
  protected pointCut = computed(() =>
    resolveUsedPoints(this.pointMode(), this.customPoints(), pointCap(this.pointBalance(), this.payable())),
  );

  /** 選用的配送方式名稱，供訂單摘要的運費列顯示 */
  protected shipName = computed(() => this.shipping()?.name ?? '');

  /** 收件資訊必填欄位是否皆已填妥 */
  protected valid = computed(() => isCheckoutFormValid(this.form()));

  /* ===============================
     使用者操作
     =============================== */

  /** 更新收件資訊的單一欄位 */
  protected onFieldChange({ field, value }: { field: CheckoutFormField; value: string }): void {
    this.form.update((form) => ({ ...form, [field]: value }));
  }

  /** 以會員個人資料一次填妥收件資訊 */
  protected onFill(): void {
    const profile = this.profile();
    if (!profile) return;
    this.form.set(profileToForm(profile));
    this.filled.set(true);
  }

  /** 送出訂單；必填欄位未填妥時，由訂單摘要顯示補填提示 */
  protected onSubmit(): void {
    this.submitted.set(true);
    const options = this.options();
    if (!this.valid() || !options || this.order()) return;
    this.checkoutApi
      .createOrder({
        recipient: formToRecipient(this.form()),
        shippingOptionId: options.shippingOptions[this.shipIndex()].id,
        paymentOptionId: options.paymentOptions[this.payIndex()].id,
        couponId: this.coupon()?.id ?? null,
        usePoints: this.pointCut(),
      })
      .subscribe((order) => this.order.set(order));
  }
}
