import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { NotificationLive } from '../../../core/services/notification-live';
import { Subject } from 'rxjs';
import { Economy } from './economy';

describe('Economy visual states', () => {
  let component: Economy;
  let fixture: ComponentFixture<Economy>;
  let http: HttpTestingController;
  const economyChanges = new Subject<void>();
  beforeEach(async () => {
    await TestBed.configureTestingModule({imports: [Economy],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: NotificationLive, useValue: { economyChanges } }]}).compileComponents();
    fixture = TestBed.createComponent(Economy);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    // 頁面載入時一併發出的流水與兌換商店請求（與本檔測的行為無關）
    http.match((r) => r.url.endsWith('/me/economy/ledger')).forEach((r) => r.flush({ total: 0, items: [] }));
    http.match((r) => r.url.endsWith('/store/coupons')).forEach((r) => r.flush([]));
    fixture.destroy();
    http.verify();
  });
  it('uses bounded gem counts as points accumulate', () => {
    // 八段視覺階段：寶石數隨點數遞增並有上限 9 顆（門檻不顯示在畫面上）
    for (const [points, level, count] of [[0, 'starter', 1], [99, 'starter', 1], [100, 'growing', 3],
      [500, 'abundant', 4], [1000, 'treasury', 5], [5000, 'treasury', 6], [20000, 'treasury', 8],
      [100000, 'treasury', 9], [2147483647, 'treasury', 9]] as const) {
      component.economy = {pointBalance: points, keyProgressBalance: 0, keyProgressToNormalKey: 100};
      expect(component.pointLevel).toBe(level);
      expect(component.pointGems.length).toBe(count);
    }
  });
  it('highlights progress at 80 percent without claiming a key has been awarded', () => {
    component.economy = {pointBalance: 113, keyProgressBalance: 79, keyProgressToNormalKey: 100};
    expect(component.isKeyAlmostReady).toBe(false);
    component.economy.keyProgressBalance = 80;
    expect(component.isKeyAlmostReady).toBe(true);
    expect(component.remainingKeyProgress).toBe(20);
    component.economy.keyProgressBalance = 100;
    expect(component.isKeyAlmostReady).toBe(false);
    expect(component.conversion).toBeNull();
  });
  it('respects a configurable target and invalid or missing progress', () => {
    expect(component.isKeyAlmostReady).toBe(false);
    component.economy = {pointBalance: 113, keyProgressBalance: 160, keyProgressToNormalKey: 200};
    expect(component.isKeyAlmostReady).toBe(true);
    component.economy.keyProgressToNormalKey = 0;
    expect(component.keyProgressPercent).toBe(0);
    expect(component.isKeyAlmostReady).toBe(false);
  });

  it('refreshes points and key progress from private live updates without repeating conversion', () => {
    fixture.detectChanges();
    http.expectOne(request => request.url.endsWith('/me/keys/convert-progress')).flush({ convertedNormalKeys: 0 });
    const initialReads = http.match(request => request.url.endsWith('/me/economy'));
    expect(initialReads).toHaveLength(1); // 主頁先載入餘額，載入後才建立鑰匙背包
    initialReads.forEach(request => request.flush({ pointBalance: 10, keyProgressBalance: 20, keyProgressToNormalKey: 100, keys: [] }));
    http.expectOne(request => request.url.endsWith('/me/economy')).flush({ pointBalance: 10, keyProgressBalance: 20, keyProgressToNormalKey: 100, keys: [] });
    http.expectOne(request => request.url.endsWith('/catalog/categories')).flush([]);
    http.expectOne(request => request.url.endsWith('/catalog/eras')).flush([]);
    http.expectOne(request => request.url.endsWith('/me/keys/exchange-rules')).flush([]);
    economyChanges.next();
    const refresh = http.expectOne(request => request.url.endsWith('/me/economy'));
    expect(refresh.request.method).toBe('GET');
    refresh.flush({ pointBalance: 15, keyProgressBalance: 25, keyProgressToNormalKey: 100 });
    expect(fixture.componentInstance.economy).toEqual({ pointBalance: 15, keyProgressBalance: 25, keyProgressToNormalKey: 100 });
    http.expectNone(request => request.url.endsWith('/me/keys/convert-progress'));
  });
});
