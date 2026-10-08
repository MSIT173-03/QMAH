import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { CatalogApi } from './catalog.api';

const listItem = (id: string, name: string) => ({
  id,
  artifactId: null,
  externalRef: null,
  name,
  categoryCode: 'CERAMIC',
  price: 100,
  discountRate: 0,
  effectivePrice: 100,
  salePrice: null,
  stock: 3,
  primaryImagePath: null,
  createdAt: '2026-01-01T00:00:00',
  averageRating: 4.5,
  reviewCount: 2,
  sellCount: 7,
});

describe('CatalogApi.getRelated', () => {
  let http: HttpTestingController;
  let names: string[];
  const subscribe = (): void => {
    names = [];
    TestBed.inject(CatalogApi)
      .getRelated({ id: 'p1', category: '陶瓷' }, 2)
      .subscribe((items) => (names = items.map((item) => item.name)));
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  it('uses the co-purchase list from the related endpoint', () => {
    subscribe();

    const request = http.expectOne((req) => req.url.endsWith('/store/products/p1/related'));
    expect(request.request.params.get('limit')).toBe('2');
    request.flush([listItem('p2', '青花瓷瓶')]);

    expect(names).toEqual(['青花瓷瓶']);
    http.verify();
  });

  it('falls back to the hottest products of the same category when nobody has bought it yet', () => {
    subscribe();

    http.expectOne((req) => req.url.endsWith('/store/products/p1/related')).flush([]);
    const fallback = http.expectOne((req) => req.url.endsWith('/store/products') && req.params.get('order') === '1');
    expect(fallback.request.params.get('pageSize')).toBe('3');
    // 熱銷清單裡有目前這件商品時要排除
    fallback.flush({
      items: [listItem('p1', '自己'), listItem('p3', '甲'), listItem('p4', '乙')],
      page: 1,
      pageSize: 3,
      totalCount: 3,
      totalPages: 1,
    });

    expect(names).toEqual(['甲', '乙']);
    http.verify();
  });
});
