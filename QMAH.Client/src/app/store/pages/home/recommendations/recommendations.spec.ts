import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { BadgedProductView } from '../home.data';
import { Recommendations } from './recommendations';

const item = (index: number): BadgedProductView => ({
  id: `p${index}`,
  cat: '',
  brand: '',
  name: `商品 ${index}`,
  price: 100,
  was: null,
  rating: 0,
  reviews: 0,
  sold: 0,
  coverImage: null,
  badge: '近期上架',
  badgeVariant: 'teal',
});

describe('Recommendations', () => {
  let fixture: ComponentFixture<Recommendations>;

  const cards = () => fixture.nativeElement.querySelectorAll('.card-grid app-product-card').length;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Recommendations], providers: [provideRouter([])] }).compileComponents();
    fixture = TestBed.createComponent(Recommendations);
    fixture.componentRef.setInput('items', Array.from({ length: 20 }, (_, i) => item(i + 1)));
  });

  afterEach(() => vi.restoreAllMocks());

  const render = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('shows only two rows of the loaded products, however many columns the grid has', async () => {
    // jsdom 不做排版：以假的計算樣式提供欄數。4 欄 × 2 行 = 8 件。
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ gridTemplateColumns: '1px 1px 1px 1px' } as CSSStyleDeclaration);
    await render();

    expect(cards()).toBe(8);
  });

  it('shows everything when the products do not fill two rows', async () => {
    fixture.componentRef.setInput('items', [item(1), item(2), item(3)]);
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ gridTemplateColumns: '1px 1px 1px 1px' } as CSSStyleDeclaration);
    await render();

    expect(cards()).toBe(3);
  });

  it('no longer offers a load-more button', async () => {
    await render();

    expect(fixture.nativeElement.querySelector('.load-more-btn')).toBeNull();
  });
});
