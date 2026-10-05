import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { NewArrivals } from './new-arrivals';

describe('NewArrivals', () => {
  let fixture: ComponentFixture<NewArrivals>;
  let animate: ReturnType<typeof vi.fn>;

  const product = {
    id: 'p1',
    artifactId: null,
    externalRef: null,
    name: '新品一號',
    categoryCode: 'BRONZE',
    price: 100,
    discountRate: 0,
    effectivePrice: 100,
    stock: 5,
    primaryImagePath: null,
    createdAt: '2026-10-01T00:00:00',
    averageRating: 0,
    reviewCount: 0,
    sellCount: 0,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewArrivals],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(NewArrivals);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne((request) => request.url.endsWith('/store/products'))
      .flush({ items: [product], page: 1, pageSize: 8, totalCount: 1, totalPages: 1 });
    // jsdom 沒有 Web Animations API；補上可觀察的 animate。
    animate = vi.fn();
    HTMLElement.prototype.animate = animate as unknown as HTMLElement['animate'];
    fixture.detectChanges();
  });

  afterEach(() => {
    delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
    delete (window as Partial<Window>).matchMedia;
  });

  it('scales the "加入" button up slightly and back when clicked, and still emits the product id', () => {
    const added = vi.fn();
    fixture.componentInstance.addToCart.subscribe(added);
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.news-add');

    button.click();

    expect(added).toHaveBeenCalledWith('p1');
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate.mock.contexts[0]).toBe(button);
    const [keyframes] = animate.mock.calls[0];
    expect(keyframes.map((frame: Keyframe) => frame['transform'])).toEqual(['scale(1)', 'scale(1.05)', 'scale(1)']);
  });
});
