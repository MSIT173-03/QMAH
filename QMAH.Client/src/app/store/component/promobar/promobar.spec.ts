import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

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
});
