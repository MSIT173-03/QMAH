import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';

import { StoreAuth } from '../../shared/store-auth';
import { Home } from './home';

describe('Home', () => {
  let component: Home;
  let fixture: ComponentFixture<Home>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      // Home 內含 routerLink（新品上架／分類導覽），RouterLink 指令需要 ActivatedRoute，
      // 故補上最小可用的路由設定，供測試環境注入。
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    // 首頁子元件包含輪播與倒數的持續性 interval；建立測試夾具不需等待它們「穩定」，
    // 否則測試會永遠等不到穩定狀態而逾時，且不影響本測試要驗證的元件建立契約。
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('has a back-to-top button that only appears after scrolling', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.home-main > app-scroll-top')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.scroll-top')).toBeNull();
    fixture.destroy();
  });
});

describe('Home purchased products lookup', () => {
  it('looks up the purchased products on entry when signed in, and only once', async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: StoreAuth, useValue: { status: signal('authenticated'), ensureLoaded: () => of(undefined), markSignedOut: () => {} } },
      ],
    }).compileComponents();
    const http = TestBed.inject(HttpTestingController);

    TestBed.createComponent(Home);
    TestBed.tick();
    const lookups = http.match((request) => request.url.endsWith('/store/orders/purchased-product-ids'));
    expect(lookups).toHaveLength(1);
    lookups[0].flush([]);
    TestBed.createComponent(Home);
    TestBed.tick();

    // 第二次進入頁面時已經有資料，不會再查詢
    http.expectNone((request) => request.url.endsWith('/store/orders/purchased-product-ids'));
  });

  it('does not look anything up for a guest', async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: StoreAuth, useValue: { status: signal('anonymous'), ensureLoaded: () => of(undefined), markSignedOut: () => {} } },
      ],
    }).compileComponents();
    const http = TestBed.inject(HttpTestingController);

    TestBed.createComponent(Home);
    TestBed.tick();

    http.expectNone((request) => request.url.endsWith('/store/orders/purchased-product-ids'));
  });
});
