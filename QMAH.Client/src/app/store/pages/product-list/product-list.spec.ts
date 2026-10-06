import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';

import { StoreAuth } from '../../shared/store-auth';
import { ProductList } from './product-list';

describe('ProductList', () => {
  let component: ProductList;
  let fixture: ComponentFixture<ProductList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductList],
      // ProductList 內含 routerLink 與分頁切換時更新網址查詢字串，兩者皆需要 Router／ActivatedRoute。
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('ProductList purchased products lookup', () => {
  it('looks up the purchased products on entry when signed in, and only once', async () => {
    await TestBed.configureTestingModule({
      imports: [ProductList],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: StoreAuth, useValue: { status: signal('authenticated'), ensureLoaded: () => of(undefined), markSignedOut: () => {} } },
      ],
    }).compileComponents();
    const http = TestBed.inject(HttpTestingController);

    TestBed.createComponent(ProductList);
    TestBed.tick();
    const lookups = http.match((request) => request.url.endsWith('/store/orders/purchased-product-ids'));
    expect(lookups).toHaveLength(1);
    lookups[0].flush([]);
    TestBed.createComponent(ProductList);
    TestBed.tick();

    // 第二次進入頁面時已經有資料，不會再查詢
    http.expectNone((request) => request.url.endsWith('/store/orders/purchased-product-ids'));
  });

  it('does not look anything up for a guest', async () => {
    await TestBed.configureTestingModule({
      imports: [ProductList],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: StoreAuth, useValue: { status: signal('anonymous'), ensureLoaded: () => of(undefined), markSignedOut: () => {} } },
      ],
    }).compileComponents();
    const http = TestBed.inject(HttpTestingController);

    TestBed.createComponent(ProductList);
    TestBed.tick();

    http.expectNone((request) => request.url.endsWith('/store/orders/purchased-product-ids'));
  });
});
