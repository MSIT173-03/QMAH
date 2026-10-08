import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { Orders } from './orders';

describe('Orders', () => {
  let component: Orders;
  let fixture: ComponentFixture<Orders>;
  let http: HttpTestingController;

  beforeEach(async () => {
    sessionStorage.removeItem('qmah.store.orderCancelNotice');
    // jsdom 尚未實作原生 <dialog> 的 showModal／close；補上最小行為（切換 open 屬性）讓對話框狀態可被斷言。
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    };

    await TestBed.configureTestingModule({
      imports: [Orders],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Orders);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const order = (id: string, status: string, paymentType: string, paymentStatus = 'PENDING') => ({
    id,
    orderNo: `QMAH-${id}`,
    status,
    paymentStatus,
    paymentType,
    totalAmount: 1280,
    createdAt: '2026-10-07T04:00:00',
    items: [{ productId: 'p1', productName: '青花瓷瓶', quantity: 2 }],
    ecpayCheckout: null,
  });

  const loadOrders = async (items: unknown[]): Promise<void> => {
    const [request] = http.match((req) => req.url.endsWith('/me/orders'));
    expect(request.request.params.get('page')).toBe('1');
    request.flush({ items, page: 1, pageSize: 20, totalCount: items.length, totalPages: 1 });
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const cards = (): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll('.order-card'));
  const cancelDialog = (): HTMLDialogElement => fixture.nativeElement.querySelector('app-order-cancel-dialog dialog');

  const click = async (element: HTMLElement): Promise<void> => {
    element.click();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  };

  it('lists orders with status, payment type and amount', async () => {
    await loadOrders([order('a', 'PENDING_PAYMENT', 'CREDIT_CARD'), order('b', 'PAID', 'CREDIT_CARD', 'PAID')]);

    expect(cards()).toHaveLength(2);
    expect(cards()[0].querySelector('.order-card-status')?.textContent?.trim()).toBe('待付款');
    expect(cards()[0].textContent).toContain('青花瓷瓶');
    expect(cards()[0].textContent).toContain('× 2');
    expect(cards()[0].textContent).toContain('$1,280');
    expect(cards()[0].textContent).toContain('信用卡');
    expect(cards()[1].querySelector('.order-card-status')?.textContent?.trim()).toBe('已付款');
  });

  it('shows cancel only for pending orders, and pay only for pending credit card orders', async () => {
    await loadOrders([
      order('a', 'PENDING_PAYMENT', 'CREDIT_CARD'),
      order('b', 'PENDING_PAYMENT', 'COD'),
      order('c', 'PAID', 'CREDIT_CARD', 'PAID'),
      order('d', 'CANCELLED', 'CREDIT_CARD', 'CANCELLED'),
    ]);

    const [card, cod, paid, cancelled] = cards();
    expect(card.querySelector('.order-cancel')).not.toBeNull();
    expect(card.querySelector('.order-pay')).not.toBeNull();
    expect(card.textContent).toContain('若已在綠界完成付款，請不要取消');
    expect(cod.querySelector('.order-cancel')).not.toBeNull();
    expect(cod.querySelector('.order-pay')).toBeNull();
    expect(paid.querySelector('.order-cancel')).toBeNull();
    expect(cancelled.querySelector('.order-cancel')).toBeNull();
  });

  it('shows an empty state when there are no orders', async () => {
    await loadOrders([]);
    expect(cards()).toHaveLength(0);
    expect(fixture.nativeElement.textContent).toContain('目前沒有訂單');
  });

  it('asks for confirmation, then posts the cancel request and reloads the page', async () => {
    await loadOrders([order('a', 'PENDING_PAYMENT', 'COD')]);
    const reload = vi.spyOn(component as unknown as { reloadPage(): void }, 'reloadPage').mockImplementation(() => undefined);

    await click(cards()[0].querySelector<HTMLButtonElement>('.order-cancel')!);
    expect(cancelDialog().hasAttribute('open')).toBe(true);
    expect(cancelDialog().textContent).toContain('取消後會歸還庫存、折價券與點數');
    expect(http.match((req) => req.url.includes('/cancel'))).toHaveLength(0);

    await click(cancelDialog().querySelector<HTMLButtonElement>('.btn-solid')!);
    const [request] = http.match((req) => req.method === 'POST' && req.url.endsWith('/store/orders/a/cancel'));
    request.flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('qmah.store.orderCancelNotice')).toContain('QMAH-a');
  });

  it('shows the backend message when the order cannot be cancelled', async () => {
    await loadOrders([order('a', 'PENDING_PAYMENT', 'CREDIT_CARD')]);

    await click(cards()[0].querySelector<HTMLButtonElement>('.order-cancel')!);
    await click(cancelDialog().querySelector<HTMLButtonElement>('.btn-solid')!);
    const [request] = http.match((req) => req.url.endsWith('/store/orders/a/cancel'));
    request.flush(
      { title: '暫時無法取消', detail: '目前無法向綠界確認付款狀態，請稍後再試。' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.orders-feedback--error')?.textContent).toContain('目前無法向綠界確認付款狀態');
    expect(cancelDialog().hasAttribute('open')).toBe(false);
  });

  it('requests a new ECPay form and submits it to the window opened on click', async () => {
    await loadOrders([order('a', 'PENDING_PAYMENT', 'CREDIT_CARD')]);
    const opened = { close: vi.fn() } as unknown as Window;
    const open = vi.spyOn(window, 'open').mockReturnValue(opened);
    const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => undefined);
    let submitted: HTMLFormElement | null = null;
    submit.mockImplementation(function (this: HTMLFormElement) {
      submitted = this;
    });

    await click(cards()[0].querySelector<HTMLButtonElement>('.order-pay')!);
    expect(open).toHaveBeenCalledWith('', 'qmah-ecpay-checkout');
    const [request] = http.match((req) => req.method === 'POST' && req.url.endsWith('/store/orders/a/ecpay-checkout'));
    request.flush({ actionUrl: 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5', fields: { MerchantTradeNo: 'ABC' } });
    await fixture.whenStable();

    expect(submit).toHaveBeenCalledTimes(1);
    expect(submitted!.target).toBe('qmah-ecpay-checkout');
    expect(submitted!.action).toBe('https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5');
    open.mockRestore();
    submit.mockRestore();
  });

  it('closes the opened window and shows the message when the form cannot be created', async () => {
    await loadOrders([order('a', 'PENDING_PAYMENT', 'CREDIT_CARD')]);
    const close = vi.fn();
    const open = vi.spyOn(window, 'open').mockReturnValue({ close } as unknown as Window);

    await click(cards()[0].querySelector<HTMLButtonElement>('.order-pay')!);
    const [request] = http.match((req) => req.url.endsWith('/store/orders/a/ecpay-checkout'));
    request.flush({ detail: '只有待付款的訂單可以前往付款。' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(close).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('.orders-feedback--error')?.textContent).toContain('只有待付款的訂單可以前往付款');
    open.mockRestore();
  });
});
