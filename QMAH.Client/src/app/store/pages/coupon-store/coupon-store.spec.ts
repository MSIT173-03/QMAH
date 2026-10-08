import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { CouponStore } from './coupon-store';

describe('CouponStore', () => {
  let component: CouponStore;
  let fixture: ComponentFixture<CouponStore>;
  let http: HttpTestingController;

  beforeEach(async () => {
    sessionStorage.removeItem('qmah.store.couponRedeemNotice');
    // jsdom 尚未實作原生 <dialog> 的 showModal／close；補上最小行為（切換 open 屬性）讓對話框狀態可被斷言。
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    };

    await TestBed.configureTestingModule({
      imports: [CouponStore],
      // 頁面內含 routerLink 與 HTTP 請求，需要 Router 與可攔截的 HttpClient。
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CouponStore);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const couponRequests = () => http.match((request) => request.url.endsWith('/store/coupons'));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('lists the coupons returned by GET /store/coupons with their point cost', async () => {
    const [request] = couponRequests();
    request.flush([
      {
        id: 'c1',
        name: '鑑定點數兌換 20 元券',
        discountType: 'FIXED',
        discountValue: 20,
        minimumAmount: 200,
        pointCost: 50,
        validityDays: 365,
        endAt: '2026-12-31T00:00:00',
      },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();

    const cards: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.coupon-card'));
    expect(cards).toHaveLength(1);
    expect(cards[0].querySelector('.coupon-card-off')?.textContent?.trim()).toBe('NT$20');
    expect(cards[0].querySelector('.coupon-card-title')?.textContent?.trim()).toBe('鑑定點數兌換 20 元券');
    expect(cards[0].querySelector('.coupon-card-cost-value')?.textContent?.trim()).toBe('50 點');
    expect(cards[0].querySelector('.coupon-card-cost-label')?.textContent?.trim()).toBe('兌換');
  });

  it('shows an empty state when no coupon can be exchanged', async () => {
    couponRequests()[0].flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.coupon-card')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('目前沒有可兌換的折價券');
  });

  it('shows an error state with a reload button when the request fails', async () => {
    couponRequests()[0].flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('折價券資料暫時無法載入');
  });

  /* ===============================
     兌換流程
     =============================== */

  const coupon = {
    id: 'c1',
    name: '鑑定點數兌換 20 元券',
    discountType: 'FIXED',
    discountValue: 20,
    minimumAmount: 200,
    pointCost: 50,
    validityDays: 365,
    endAt: '2026-12-31T00:00:00',
  };

  /** 載入一張折價券，並依登入與否回應 GET /me（商城以它確認登入狀態） */
  const loadCoupon = async (signedIn: boolean): Promise<void> => {
    couponRequests()[0].flush([coupon]);
    const me = http.match((request) => request.url.endsWith('/me'));
    for (const request of me) {
      if (signedIn) request.flush({ email: 'demo@qmah.test', displayName: 'Demo', pointBalance: 100 });
      else request.flush(null, { status: 401, statusText: 'Unauthorized' });
    }
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const costButton = (): HTMLButtonElement => fixture.nativeElement.querySelector('.coupon-card-cost');
  const dialog = (): HTMLDialogElement => fixture.nativeElement.querySelector('app-coupon-redeem-dialog dialog');
  const loginDialog = (): HTMLDialogElement => fixture.nativeElement.querySelector('app-login-prompt dialog');

  const click = async (element: HTMLElement): Promise<void> => {
    element.click();
    // 登入狀態確認是非同步的；等它與對話框的 effect 都完成。
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  };

  it('asks guests to sign in instead of redeeming', async () => {
    await loadCoupon(false);

    await click(costButton());

    expect(loginDialog().open).toBe(true);
    expect(dialog().open).toBe(false);
    expect(http.match((request) => request.url.includes('/redeem'))).toHaveLength(0);
  });

  it('asks signed-in members to confirm with the coupon name and price before redeeming', async () => {
    await loadCoupon(true);

    await click(costButton());

    expect(loginDialog().open).toBe(false);
    expect(dialog().open).toBe(true);
    expect(dialog().textContent).toContain('鑑定點數兌換 20 元券');
    expect(dialog().textContent).toContain('50 點');
    // 還沒確認，不能先呼叫後端。
    expect(http.match((request) => request.url.includes('/redeem'))).toHaveLength(0);
  });

  it('reloads the page after a successful redeem and keeps the result for after the reload', async () => {
    const reload = vi.spyOn(component as unknown as { reloadPage(): void }, 'reloadPage').mockImplementation(() => undefined);
    await loadCoupon(true);
    await click(costButton());
    await click(dialog().querySelector('.btn-solid')!);

    const [request] = http.match((req) => req.method === 'POST' && req.url.endsWith('/store/coupons/c1/redeem'));
    expect(request).toBeTruthy();
    request.flush({
      userCouponId: 'u1',
      name: '鑑定點數兌換 20 元券',
      pointCost: 50,
      remainingPoints: 150,
      expiresAt: '2027-10-01T00:00:00',
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(reload).toHaveBeenCalledTimes(1);
    // 重新整理前不直接顯示結果；訊息暫存起來，等整理後的頁面載入完成再顯示。
    expect(fixture.nativeElement.querySelector('.coupon-feedback')).toBeNull();
    expect(sessionStorage.getItem('qmah.store.couponRedeemNotice')).toContain('剩餘 150 點');
  });

  it('shows the stored redeem result once the reloaded page has finished loading', async () => {
    sessionStorage.setItem('qmah.store.couponRedeemNotice', '已兌換「鑑定點數兌換 20 元券」，扣除 50 點，剩餘 150 點。');
    // 模擬重新整理後重新建立頁面。
    fixture = TestBed.createComponent(CouponStore);
    fixture.detectChanges();

    // 清單還在載入：先不顯示。
    expect(fixture.nativeElement.querySelector('.coupon-feedback')).toBeNull();

    const requests = couponRequests();
    requests[requests.length - 1].flush([coupon]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.coupon-feedback')?.textContent).toContain('剩餘 150 點');
    // 訊息只顯示一次：已從暫存移除。
    expect(sessionStorage.getItem('qmah.store.couponRedeemNotice')).toBeNull();
  });

  /* ===============================
     我的折價券
     =============================== */

  const ownedCoupon = {
    id: 'u1',
    name: '新會員圖鑑禮',
    discountType: 'FIXED',
    discountValue: 80,
    minimumAmount: 500,
    status: 'AVAILABLE',
    endAt: '2026-12-31T00:00:00',
    expiresAt: '2026-10-05T00:00:00',
  };
  const ownedSection = (): HTMLElement | null => fixture.nativeElement.querySelector('.my-coupons');

  /** 載入商店券，依登入與否回應 GET /me，登入時再回應 GET /me/coupons */
  const loadOwned = async (signedIn: boolean, owned: unknown[]): Promise<void> => {
    couponRequests()[0].flush([coupon]);
    for (const request of http.match((req) => req.url.endsWith('/me'))) {
      if (signedIn) request.flush({ email: 'demo@qmah.test', displayName: 'Demo', pointBalance: 100 });
      else request.flush(null, { status: 401, statusText: 'Unauthorized' });
    }
    await fixture.whenStable();
    fixture.detectChanges();
    for (const request of http.match((req) => req.url.endsWith('/me/coupons'))) request.flush(owned);
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('shows guests a login button in "my coupons" instead of coupons, without requesting any', async () => {
    await loadOwned(false, []);

    const login = ownedSection()?.querySelector('a.my-coupons-login-btn');
    expect(login?.textContent?.trim()).toBe('登入');
    expect(login?.getAttribute('href')).toBe('/login?returnUrl=%2Fstore%2Fcoupons');
    expect(ownedSection()?.querySelectorAll('.coupon-card')).toHaveLength(0);
    expect(http.match((req) => req.url.endsWith('/me/coupons'))).toHaveLength(0);
  });

  it('shows the coupons the account owns in the same card form, with the due date instead of a price', async () => {
    await loadOwned(true, [ownedCoupon, { ...ownedCoupon, id: 'u2', name: '已使用的券', status: 'USED' }]);

    const cards: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.my-coupons .coupon-card'));
    // 只列出可使用（AVAILABLE）的券
    expect(cards).toHaveLength(1);
    expect(cards[0].querySelector('.coupon-card-off')?.textContent?.trim()).toBe('NT$80');
    expect(cards[0].querySelector('.coupon-card-title')?.textContent?.trim()).toBe('新會員圖鑑禮');
    expect(cards[0].querySelectorAll('.coupon-card-meta')[0]?.textContent?.trim()).toBe('最低消費 NT$500');
    expect(cards[0].querySelector('.coupon-card-cost-label')?.textContent?.trim()).toBe('持有中');
    expect(cards[0].querySelector('.coupon-card-cost-value')?.textContent?.trim()).toBe('10/05 到期');
    // 持有中的券不能再兌換：右側不是按鈕
    expect(cards[0].querySelector('button')).toBeNull();
  });

  it('stacks "my coupons" below the exchange store, each with its own title row and no coupon count', async () => {
    await loadOwned(true, [ownedCoupon]);

    const sections: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.coupon-store-main > .coupon-section'));
    expect(sections).toHaveLength(2);
    expect(sections[0].classList.contains('coupon-shop')).toBe(true);
    expect(sections[1].classList.contains('my-coupons')).toBe(true);
    expect(sections.map((section) => section.querySelector('h1.page-title')?.textContent?.trim())).toEqual([
      '兌換商店',
      '我的折價券',
    ]);
    // 標題旁不再有「n 張折價券」
    expect(fixture.nativeElement.querySelector('.page-title-count')).toBeNull();
    // 不再是兩欄
    expect(fixture.nativeElement.querySelector('.coupon-columns')).toBeNull();
  });

  it('shows the exchange store first to guests, with the "my coupons" login prompt below it', async () => {
    await loadOwned(false, []);

    const sections: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.coupon-store-main > .coupon-section'));
    expect(sections).toHaveLength(2);
    expect(sections[0].classList.contains('coupon-shop')).toBe(true);
    expect(sections[0].querySelector('h1.page-title')?.textContent?.trim()).toBe('兌換商店');
    expect(sections[1].classList.contains('my-coupons')).toBe(true);
  });

  it('has a back-to-top button that only appears after scrolling', async () => {
    await loadOwned(true, []);
    expect(fixture.nativeElement.querySelector('app-scroll-top')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.scroll-top')).toBeNull();
  });

  it('no longer has a collapse button for "my coupons"', async () => {
    await loadOwned(true, [ownedCoupon]);

    expect(fixture.nativeElement.querySelector('.my-coupons-toggle')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.my-coupons .coupon-card')).toHaveLength(1);
  });

  it('says so when the account owns no coupon', async () => {
    await loadOwned(true, []);

    expect(ownedSection()?.textContent).toContain('目前沒有折價券');
    expect(fixture.nativeElement.querySelectorAll('.my-coupons .coupon-card')).toHaveLength(0);
  });

  /* ===============================
     兌換成功訊息：自動消失與關閉
     =============================== */

  const noticeKey = 'qmah.store.couponRedeemNotice';
  const feedback = (): HTMLElement | null => fixture.nativeElement.querySelector('.coupon-feedback');

  /** 模擬「兌換成功並重新整理後」的頁面：暫存訊息存在、清單載入完成 */
  const showNotice = async (): Promise<void> => {
    sessionStorage.setItem(noticeKey, '已兌換「鑑定點數兌換 20 元券」，扣除 50 點，剩餘 150 點。');
    fixture = TestBed.createComponent(CouponStore);
    fixture.detectChanges();
    const requests = couponRequests();
    requests[requests.length - 1].flush([coupon]);
    // 假計時器下 whenStable 會一直等不到：只讓已排入的微任務跑完即可。
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
  };

  /** 前進假時間，並讓 Angular 套用狀態變更 */
  const advance = async (ms: number): Promise<void> => {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  };

  describe('success notice', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const slot = (): HTMLElement | null => fixture.nativeElement.querySelector('.coupon-feedback-slot');

    it('fades out and disappears 5 seconds after it is shown', async () => {
      await showNotice();
      expect(feedback()).not.toBeNull();
      expect(feedback()?.classList.contains('coupon-feedback--leaving')).toBe(false);
      expect(slot()?.classList.contains('coupon-feedback-slot--leaving')).toBe(false);

      await advance(4_900);
      expect(feedback()).not.toBeNull();
      expect(feedback()?.classList.contains('coupon-feedback--leaving')).toBe(false);

      // 滿 5 秒：先套用淡出樣式，淡出結束才移除。
      await advance(200);
      expect(feedback()?.classList.contains('coupon-feedback--leaving')).toBe(true);
      // 同時收合外層，下方內容在淡出期間就開始上移
      expect(slot()?.classList.contains('coupon-feedback-slot--leaving')).toBe(true);

      await advance(300);
      expect(feedback()).toBeNull();
      expect(slot()).toBeNull();
    });

    it('closes right away with the cross button, fading out first', async () => {
      await showNotice();
      const close: HTMLButtonElement = feedback()!.querySelector('.coupon-feedback-close')!;
      expect(close.getAttribute('aria-label')).toBe('關閉訊息');
      expect(close.querySelector('svg')).not.toBeNull();

      close.click();
      fixture.detectChanges();
      expect(feedback()?.classList.contains('coupon-feedback--leaving')).toBe(true);

      await advance(300);
      expect(feedback()).toBeNull();
    });

    it('does not remove an error message automatically', async () => {
      vi.useRealTimers();
      await loadCoupon(true);
      await click(costButton());
      await click(dialog().querySelector('.btn-solid')!);
      const [request] = http.match((req) => req.url.endsWith('/store/coupons/c1/redeem'));
      request.flush({ detail: '鑑定點數不足，不能兌換這張折價券。' }, { status: 409, statusText: 'Conflict' });
      await fixture.whenStable();
      fixture.detectChanges();

      vi.useFakeTimers();
      await advance(30_000);
      expect(feedback()?.classList.contains('coupon-feedback--error')).toBe(true);
    });
  });

  it('shows the backend explanation when the redeem is rejected', async () => {
    await loadCoupon(true);
    await click(costButton());
    await click(dialog().querySelector('.btn-solid')!);

    const [request] = http.match((req) => req.url.endsWith('/store/coupons/c1/redeem'));
    request.flush(
      { title: '無法兌換這張折價券', detail: '鑑定點數不足，不能兌換這張折價券。' },
      { status: 409, statusText: 'Conflict' },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    const feedback: HTMLElement = fixture.nativeElement.querySelector('.coupon-feedback--error');
    expect(feedback.textContent).toContain('鑑定點數不足');
  });
});
