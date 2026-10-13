import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';

import { StoreAuth } from '../../shared/store-auth';
import { Checkout } from './checkout';

describe('Checkout', () => {
  let component: Checkout;
  let fixture: ComponentFixture<Checkout>;
  let http: HttpTestingController;

  beforeEach(async () => {
    // jsdom 尚未實作原生 <dialog> 的 showModal／close；補上最小行為讓訂單成立提示可以開啟。
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    };

    await TestBed.configureTestingModule({
      imports: [Checkout],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Checkout);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  const quote = {
    lines: [
      { productId: 'p1', name: '青花瓷瓶', qty: 2, lineTotal: 2000 },
      { productId: 'p2', name: '白瓷杯', qty: 1, lineTotal: 500 },
    ],
    subtotal: 2500,
    itemDiscount: 0,
    shippingFee: 0,
    couponDiscount: 0,
    pointsUsed: 0,
    payable: 2500,
    pointsEarned: 25,
    shippingOptions: [{ id: 'HOME', name: '宅配', fee: 0 }],
    usableCouponIds: [],
    pointCap: 20,
  };

  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  };

  const orderRequests = (): TestRequest[] =>
    http.match((req) => req.method === 'POST' && req.url.endsWith('/store/orders'));
  const quoteRequests = (): TestRequest[] => http.match((req) => req.url.endsWith('/store/checkout/quote'));

  /** 回應結帳頁載入時的查詢，並填妥收件資訊，讓訂單可以送出 */
  const ready = async (): Promise<void> => {
    http.match((req) => req.url.endsWith('/store/checkout/options')).forEach((request) =>
      request.flush({
        shippingOptions: [{ id: 'HOME', name: '宅配', fee: 100 }],
        paymentOptions: [{ id: 'COD', name: '貨到付款' }],
        freeShippingThreshold: 1000,
        pointEarnRate: 0.01,
      }),
    );
    await settle();
    quoteRequests().forEach((request) => request.flush(quote));
    (component as unknown as { form: { set(value: object): void } }).form.set({
      name: '王小明',
      phone: '0912345678',
      email: '',
      postalCode: '100',
      city: '臺北市',
      district: '中正區',
      address: '測試路 1 號',
      taxId: '',
      note: '',
    });
    await settle();
  };

  const submitButton = (): HTMLButtonElement =>
    fixture.nativeElement.querySelector('app-checkout-summary .btn-solid');
  const submit = async (): Promise<void> => {
    submitButton().click();
    await settle();
  };

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('sends a single order request when confirm is clicked twice while submitting', async () => {
    await ready();

    submitButton().click();
    submitButton().click();
    await settle();

    expect(submitButton().disabled).toBe(true);
    expect(submitButton().textContent).toContain('送出中');
    expect(orderRequests()).toHaveLength(1);
  });

  it('reuses the idempotency key when the order is resent after a failure', async () => {
    await ready();

    await submit();
    const [first] = orderRequests();
    first.flush(null, { status: 500, statusText: 'Internal Server Error' });
    await settle();

    await submit();
    const [second] = orderRequests();
    expect(second.request.body.idempotencyKey).toBeTruthy();
    expect(second.request.body.idempotencyKey).toBe(first.request.body.idempotencyKey);
    // 結果不明時保留原試算，重送的商品才會跟第一次相同。
    expect(quoteRequests()).toHaveLength(0);
  });

  it('shows the backend detail and re-enables the button when the order is rejected', async () => {
    await ready();

    await submit();
    orderRequests()[0].flush(
      { title: '商品庫存不足', detail: '商品「青花瓷瓶」目前庫存不足。' },
      { status: 409, statusText: 'Conflict' },
    );
    await settle();

    expect(fixture.nativeElement.querySelector('app-checkout-summary [role="alert"]')?.textContent).toContain(
      '商品「青花瓷瓶」目前庫存不足。',
    );
    expect(submitButton().disabled).toBe(false);
    // 被拒絕後重新試算，金額才會反映最新的庫存或優惠券狀態。
    expect(quoteRequests()).toHaveLength(1);
  });

  it('signs the member out and goes to the login page on 401', async () => {
    await ready();
    const markSignedOut = vi.spyOn(TestBed.inject(StoreAuth), 'markSignedOut');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    await submit();
    orderRequests()[0].flush(null, { status: 401, statusText: 'Unauthorized' });
    await settle();

    expect(markSignedOut).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/login?returnUrl=%2Fstore%2Fcheckout');
  });

  it('orders the quoted lines without reading the cart again', async () => {
    await ready();

    await submit();
    const [request] = orderRequests();

    expect(request.request.body.items).toEqual([
      { productId: 'p1', quantity: 2 },
      { productId: 'p2', quantity: 1 },
    ]);
    expect(http.match((req) => req.url.endsWith('/me/cart'))).toHaveLength(0);
    expect(quoteRequests()).toHaveLength(0);
  });
});
