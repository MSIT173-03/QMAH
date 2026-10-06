import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { StoreAuth } from '../../shared/store-auth';
import { ProductInfo } from './product-info';

describe('ProductInfo', () => {
  let component: ProductInfo;
  let fixture: ComponentFixture<ProductInfo>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductInfo],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: StoreAuth, useValue: { status: signal('authenticated'), ensureLoaded: () => of(undefined), markSignedOut: () => {} } },
      ],
    })
    .compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProductInfo);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  /* ===============================
     自己的評價
     =============================== */

  const productDto = {
    id: 'p1',
    artifactId: null,
    artifactRef: null,
    artifactName: null,
    externalRef: null,
    name: '元豐通寶明信片套組',
    categoryCode: 'COIN',
    description: null,
    sizeText: null,
    artifactSizeText: null,
    price: 100,
    discountRate: 0,
    effectivePrice: 100,
    stock: 5,
    primaryImagePath: null,
    sourceUrl: null,
    isActive: true,
    averageRating: 4,
    reviewCount: 1,
  };
  const reviewDto = (overrides: Record<string, unknown> = {}) => ({
    id: 'r-other',
    productId: 'p1',
    userId: 'u-other',
    displayName: '別人',
    rating: 4,
    content: '很不錯',
    isVerifiedPurchase: true,
    createdAt: '2026-09-01T08:00:00',
    updatedAt: '2026-09-01T08:00:00',
    ...overrides,
  });
  const urlEndsWith = (suffix: string) => (request: { url: string }) => request.url.endsWith(suffix);

  /** 開啟商品頁並回應商品、評價與「已購買商品」，purchasedIds 為會員買過的商品編號 */
  const openProduct = async (purchasedIds: string[], extraReviews: Record<string, unknown>[] = []): Promise<void> => {
    fixture.componentRef.setInput('id', 'p1');
    fixture.detectChanges();
    TestBed.tick();
    http.match(urlEndsWith('/me/cart')).forEach((request) => request.flush([]));
    http.expectOne(urlEndsWith('/store/products/p1')).flush(productDto);
    http
      .expectOne(urlEndsWith('/store/products/p1/reviews'))
      .flush({
        summary: { averageRating: 4, reviewCount: 1 + extraReviews.length },
        reviews: { items: [reviewDto(), ...extraReviews], page: 1, pageSize: 100, totalCount: 1 + extraReviews.length, totalPages: 1 },
      });
    http.expectOne(urlEndsWith('/store/orders/purchased-product-ids')).flush(purchasedIds);
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const el = (selector: string): HTMLElement | null => fixture.nativeElement.querySelector(selector);
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const fill = async (stars: number, text: string): Promise<void> => {
    (el(`.review-star:nth-child(${stars})`) as HTMLButtonElement).click();
    const input = el('.review-input') as HTMLTextAreaElement;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  it('offers no review form for a product the member has not bought, and never asks for their review', async () => {
    await openProduct(['some-other-product']);

    expect(el('.review-editor')).toBeNull();
    http.expectNone(urlEndsWith('/store/products/p1/reviews/me'));
  });

  it('shows the form for a bought product, saves a new review and shows it as read-only text', async () => {
    await openProduct(['P1']);
    http.expectOne(urlEndsWith('/store/products/p1/reviews/me')).flush(null, { status: 404, statusText: 'Not Found' });
    await settle();
    expect(el('.review-editor')).not.toBeNull();

    await fill(5, '做工細緻，推薦');
    (el('.review-actions button[type="submit"]') as HTMLButtonElement).click();

    const put = http.expectOne((request) => request.method === 'PUT' && request.url.endsWith('/store/products/p1/reviews/me'));
    expect(put.request.body).toEqual({ rating: 5, content: '做工細緻，推薦' });
    put.flush(reviewDto({ id: 'r-mine', userId: 'u-me', displayName: '我', rating: 5, content: '做工細緻，推薦', createdAt: '2026-10-06T06:00:00', updatedAt: '2026-10-06T06:00:00' }));
    await settle();

    expect(el('.review-editor')).toBeNull();
    expect(el('.review-card--mine .review-text')?.textContent?.trim()).toBe('做工細緻，推薦');
    expect(el('.review-card--mine .review-edited')).toBeNull();
    // 評價清單只列別人的評價，自己的只在上方的區塊；標題的評論數與評分則含自己的（原本 1 則，加上自己的 2 則）
    const listed = Array.from(fixture.nativeElement.querySelectorAll('.review-card:not(.review-card--mine)')) as HTMLElement[];
    expect(listed.map((card) => card.querySelector('.review-text')?.textContent?.trim())).toEqual(['很不錯']);
    expect(el('.reviews-summary')?.textContent).toContain('2 則評論');
    expect(el('.reviews-summary')?.textContent).toContain('4.5');
  });

  it('lets the member edit a submitted review and shows when it was edited', async () => {
    const own = reviewDto({ id: 'r-mine', userId: 'u-me', displayName: '我', rating: 3, content: '還可以', createdAt: '2026-10-01T08:00:00', updatedAt: '2026-10-01T08:00:00' });
    await openProduct(['p1'], [own]);
    http.expectOne(urlEndsWith('/store/products/p1/reviews/me')).flush(own);
    await settle();
    // 自己的評價只在上方已確認的區塊，不會再出現在下方的評價清單
    const listedTexts = () =>
      (Array.from(fixture.nativeElement.querySelectorAll('.review-card:not(.review-card--mine)')) as HTMLElement[]).map((card) =>
        card.querySelector('.review-text')?.textContent?.trim(),
      );
    expect(listedTexts()).toEqual(['很不錯']);
    expect(el('.review-card--mine .review-text')?.textContent?.trim()).toBe('還可以');
    expect(el('.review-card--mine textarea')).toBeNull();

    (el('.review-card--mine .review-edit') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fill(5, '用久了更喜歡');
    (el('.review-actions button[type="submit"]') as HTMLButtonElement).click();

    const put = http.expectOne((request) => request.method === 'PUT');
    expect(put.request.body).toEqual({ rating: 5, content: '用久了更喜歡' });
    put.flush(
      reviewDto({ id: 'r-mine', userId: 'u-me', displayName: '我', rating: 5, content: '用久了更喜歡', createdAt: '2026-10-01T08:00:00', updatedAt: '2026-10-06T06:30:00' }),
    );
    await settle();

    expect(el('.review-editor')).toBeNull();
    expect(el('.review-card--mine .review-text')?.textContent?.trim()).toBe('用久了更喜歡');
    expect(el('.review-card--mine .review-edited')?.textContent).toContain('編輯於');
    // 同一則評價取代原本的內容，評論數不增加，清單仍然只有別人的評價
    expect(el('.reviews-summary')?.textContent).toContain('2 則評論');
    expect(listedTexts()).toEqual(['很不錯']);
  });

  it('keeps the form and explains when the backend rejects the review', async () => {
    await openProduct(['p1']);
    http.expectOne(urlEndsWith('/store/products/p1/reviews/me')).flush(null, { status: 404, statusText: 'Not Found' });
    await settle();
    await fill(2, '普通');
    (el('.review-actions button[type="submit"]') as HTMLButtonElement).click();

    http.expectOne((request) => request.method === 'PUT').flush({ detail: '評價內容不可只有空白。' }, { status: 400, statusText: 'Bad Request' });
    await settle();

    expect(el('.review-editor')).not.toBeNull();
    expect(el('.review-error')?.textContent?.trim()).toBe('評價內容不可只有空白。');
  });
});
