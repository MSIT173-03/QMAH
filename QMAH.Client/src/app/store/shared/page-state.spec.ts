import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';

import { injectCartState } from './page-state';

describe('injectCartState', () => {
  let httpMock: HttpTestingController;
  let cart: ReturnType<typeof injectCartState>;

  const member = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'member@qmah.local',
    displayName: '測試會員',
    status: 'ACTIVE',
    pointBalance: 0,
    roles: [],
    createdAt: '2026-01-01T00:00:00Z',
    bio: null,
    visibility: 'PRIVATE',
    avatarPath: null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    cart = runInInjectionContext(TestBed.inject(Injector), () => injectCartState());
  });

  afterEach(() => httpMock.verify());

  it('未登入時加入購物車只顯示登入提示，不送出購物車請求', () => {
    httpMock.expectOne((r) => r.url.endsWith('/me')).flush(
      { message: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' },
    );
    expect(cart.signedIn()).toBe(false);
    expect(cart.cart()?.items).toEqual([]);

    const done = vi.fn();
    cart.add('p-1', 1, done);

    httpMock.expectNone((r) => r.url.includes('/me/cart'));
    expect(cart.loginPrompt()).toBe(true);
    expect(done).not.toHaveBeenCalled();
  });

  it('登入提示：取消留在原頁，確認則帶 returnUrl 前往登入頁', () => {
    httpMock.expectOne((r) => r.url.endsWith('/me')).flush(
      { message: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' },
    );
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    cart.add('p-1');
    cart.cancelLogin();
    expect(cart.loginPrompt()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();

    cart.add('p-1');
    cart.confirmLogin();
    expect(cart.loginPrompt()).toBe(false);
    expect(navigate).toHaveBeenCalledWith('/login?returnUrl=%2F');
  });

  it('已登入時正常加入購物車', () => {
    httpMock.expectOne((r) => r.url.endsWith('/me')).flush(member);
    httpMock.expectOne((r) => r.url.endsWith('/me/cart') && r.method === 'GET').flush([]);
    expect(cart.signedIn()).toBe(true);

    const done = vi.fn();
    cart.add('p-1', 2, done);

    const post = httpMock.expectOne((r) => r.url.endsWith('/me/cart') && r.method === 'POST');
    expect(post.request.body).toEqual({ productId: 'p-1', quantity: 2 });
    post.flush({});
    httpMock.expectOne((r) => r.url.endsWith('/me/cart') && r.method === 'GET').flush([]);

    expect(cart.loginPrompt()).toBe(false);
    expect(done).toHaveBeenCalled();
  });

  it('登入已失效（寫入回應 401）時改為顯示登入提示', () => {
    httpMock.expectOne((r) => r.url.endsWith('/me')).flush(member);
    httpMock.expectOne((r) => r.url.endsWith('/me/cart') && r.method === 'GET').flush([]);

    cart.add('p-1');
    httpMock.expectOne((r) => r.url.endsWith('/me/cart') && r.method === 'POST').flush(
      { message: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(cart.signedIn()).toBe(false);
    expect(cart.loginPrompt()).toBe(true);
  });
});
