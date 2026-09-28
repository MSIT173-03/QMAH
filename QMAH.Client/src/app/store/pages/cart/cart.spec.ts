import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { Cart } from './cart';
import { CartApi, CatalogApi } from '../../api';
import { CartItem, Product, ProductQuery, ShoppingCart } from '../../api/api.models';
import { StoreAuth } from '../../shared/store-auth';

describe('Cart', () => {
  let component: Cart;
  let fixture: ComponentFixture<Cart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Cart],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Cart);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('Cart add-ons', () => {
  const cartItem = (productId: string, category: string, qty: number): CartItem => ({
    productId,
    coverImage: null,
    brand: '',
    category,
    name: productId,
    dimensions: '',
    price: 100,
    originalPrice: null,
    qty,
    lineTotal: 100 * qty,
  });
  const product = (id: string): Product => ({
    id,
    name: id,
    brand: '',
    category: '青銅器',
    price: 100,
    dealPrice: 100,
    discountRate: 0,
    rating: 0,
    reviewCount: 0,
    soldCount: 0,
    source: '',
    dimensions: '',
    listedAt: '2026-01-01',
    coverImage: null,
  });

  // 青銅器共 3 件（2 個品項），陶瓷 2 件：件數最多的器類是青銅器。
  const cart: ShoppingCart = {
    items: [cartItem('bronze-1', '青銅器', 1), cartItem('ceramic-1', '陶瓷', 2), cartItem('bronze-2', '青銅器', 2)],
    amounts: {
      subtotal: 500,
      itemDiscount: 0,
      shippingFee: null,
      payable: 500,
      freeShippingThreshold: null,
      freeShippingShortfall: null,
    },
  };
  let productQueries: ProductQuery[];
  /** 測試中的購物車狀態；加入時與後端相同：已有同商品則累加數量，否則新增一行 */
  let current: ShoppingCart;

  beforeEach(async () => {
    productQueries = [];
    current = cart;
    await TestBed.configureTestingModule({
      imports: [Cart],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: StoreAuth, useValue: { status: signal('authenticated'), ensureLoaded: () => of(undefined), markSignedOut: () => {} } },
        {
          provide: CartApi,
          useValue: {
            getCart: () => of(current),
            addItem: (productId: string) => {
              const existing = current.items.some((item) => item.productId === productId);
              current = {
                ...current,
                items: existing
                  ? current.items.map((item) => (item.productId === productId ? { ...item, qty: item.qty + 1 } : item))
                  : [...current.items, cartItem(productId, '青銅器', 1)],
              };
              return of(current);
            },
          },
        },
        {
          provide: CatalogApi,
          useValue: {
            // 頂部公告列讀取的商城公告
            getPromotions: () => of([]),
            getProducts: (query: ProductQuery) => {
              productQueries.push(query);
              // 隨機結果中混入一件已在購物車內的商品，應被排除。
              const ids = ['bronze-2', 'a', 'b', 'c', 'd', 'e', 'f', 'g'];
              return of({ items: ids.map(product), total: ids.length, page: 1, pageSize: query.pageSize ?? ids.length });
            },
          },
        },
      ],
    }).compileComponents();
  });

  it('renders cart lines and five random add-ons from the dominant category', async () => {
    const fixture = TestBed.createComponent(Cart);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelectorAll('app-cart-line').length).toBe(3);
    // 頂部公告列：已登入時顯示點數、折價券與購物車件數（1 + 2 + 2）。
    const promobarLinks = Array.from(element.querySelectorAll('app-promobar .promobar-link')).map((link) => link.textContent?.replace(/\s+/g, ' ').trim());
    expect(promobarLinks).toContain('購物車 5 件');
    expect(element.querySelector('app-site-header')).toBeNull();

    expect(productQueries.length).toBe(1);
    expect(productQueries[0].cat).toBe('青銅器');
    expect(productQueries[0].order).toBe(6);
    expect(productQueries[0].pageSize).toBeGreaterThan(5);

    const addons = Array.from(element.querySelectorAll('app-cart-addons app-product-card'));
    expect(addons.length).toBe(5);
  });

  it('keeps an added add-on marked as added and animates only its new cart line', async () => {
    const fixture = TestBed.createComponent(Cart);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const lines = () => Array.from(element.querySelectorAll<HTMLElement>('app-cart-line .cart-line'));
    const entering = () => lines().filter((line) => line.classList.contains('cart-line--entering'));
    const buttons = () => Array.from(element.querySelectorAll<HTMLButtonElement>('app-cart-addons .product-card-buy'));
    // 首次載入的購物車行不播放進場動畫。
    expect(lines().length).toBe(3);
    expect(entering().length).toBe(0);

    buttons()[0].click();
    fixture.detectChanges();

    // 新的一行出現並播放進場動畫；卡片保留（仍是 5 張），按鈕維持反白並顯示打勾。
    expect(lines().length).toBe(4);
    expect(entering()).toEqual([lines()[3]]);
    expect(buttons().length).toBe(5);
    expect(buttons()[0].classList.contains('product-card-buy--added')).toBe(true);
    expect(buttons()[0].querySelector('.product-card-buy-check')).not.toBeNull();
    expect(buttons().slice(1).some((button) => button.classList.contains('product-card-buy--added'))).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 350));
    fixture.detectChanges();
    expect(entering().length).toBe(0);

    // 再次點擊只累加數量，不新增購物車行，也不再播放進場動畫。
    buttons()[0].click();
    fixture.detectChanges();
    expect(lines().length).toBe(4);
    expect(entering().length).toBe(0);
    expect(buttons()[0].classList.contains('product-card-buy--added')).toBe(true);
  });
});
