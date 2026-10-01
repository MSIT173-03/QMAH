import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { CartItem } from '../../api/api.models';
import { Promobar } from './promobar';

describe('Promobar', () => {
  let component: Promobar;
  let fixture: ComponentFixture<Promobar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Promobar],
      providers: [provideRouter([])],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Promobar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  const actions = (): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('.promobar-actions .promobar-link'));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows member shortcuts as disabled text before sign-in', () => {
    fixture.componentRef.setInput('signedIn', false);
    fixture.detectChanges();

    const items = actions();
    expect(items.map((item) => item.textContent?.trim())).toEqual(['點數', '折價券', '購物車']);
    expect(items.every((item) => item.tagName === 'SPAN' && item.getAttribute('aria-disabled') === 'true')).toBe(true);
  });

  it('shows points, coupons and cart links with counts after sign-in', () => {
    fixture.componentRef.setInput('signedIn', true);
    fixture.componentRef.setInput('points', '120');
    fixture.componentRef.setInput('cartCount', 3);
    fixture.detectChanges();

    const items = actions();
    expect(items.map((item) => item.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      '點數 120',
      '折價券 0 張',
      '購物車 3 件',
    ]);
    expect(items.every((item) => item.tagName === 'A')).toBe(true);
    expect(items[2].getAttribute('href')).toBe('/store/cart');
  });
  const cartItem = (index: number, qty = 1): CartItem => ({
    productId: `p${index}`,
    coverImage: null,
    brand: '',
    category: '',
    name: `商品 ${index}`,
    dimensions: '',
    price: 100,
    originalPrice: null,
    qty,
    lineTotal: 100 * qty,
  });

  const cartPanelItems = (): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('.cart-panel .cart-panel-item'));

  const showCart = (items: CartItem[]): void => {
    fixture.componentRef.setInput('signedIn', true);
    fixture.componentRef.setInput('cartItems', items);
    fixture.detectChanges();
  };

  it('opens the cart panel on hover and closes it on leave', () => {
    showCart([cartItem(1)]);
    const trigger: HTMLElement = fixture.nativeElement.querySelector('.cart-trigger');
    const panel: HTMLElement = fixture.nativeElement.querySelector('.cart-panel');
    expect(panel.classList.contains('cart-panel--open')).toBe(false);

    trigger.dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();
    expect(panel.classList.contains('cart-panel--open')).toBe(true);

    trigger.dispatchEvent(new Event('mouseleave'));
    fixture.detectChanges();
    expect(panel.classList.contains('cart-panel--open')).toBe(false);
  });

  it('lists cart items with name, quantity and a link to the product page', () => {
    showCart([cartItem(1, 2), cartItem(2, 1)]);

    const rows = cartPanelItems();
    expect(rows.map((row) => row.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['商品 1× 2', '商品 2× 1']);
    expect(rows.map((row) => row.getAttribute('href'))).toEqual(['/store/product/p1', '/store/product/p2']);
    expect(fixture.nativeElement.querySelector('.cart-panel-more')).toBeNull();
  });

  it('shows at most five items and summarizes the rest', () => {
    showCart(Array.from({ length: 8 }, (_, i) => cartItem(i + 1)));

    expect(cartPanelItems()).toHaveLength(5);
    expect(fixture.nativeElement.querySelector('.cart-panel-more')?.textContent?.trim()).toBe('以及另外 3 項商品');
  });

  it('does not show the summary line when there are exactly five items', () => {
    showCart(Array.from({ length: 5 }, (_, i) => cartItem(i + 1)));

    expect(cartPanelItems()).toHaveLength(5);
    expect(fixture.nativeElement.querySelector('.cart-panel-more')).toBeNull();
  });

  it('shows an empty hint when the cart has no items', () => {
    showCart([]);

    expect(cartPanelItems()).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('.cart-panel-empty')?.textContent?.trim()).toBe('購物車目前沒有商品');
  });
});
