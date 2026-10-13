import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { publicCatalogCacheInterceptor } from './public-catalog-cache';

describe('Public reference request sharing', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  const url = (path: string) => `${environment.apiBaseUrl}${path}`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([publicCatalogCacheInterceptor])),
      provideHttpClientTesting(),
    ] });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });
  afterEach(() => backend.verify());

  it('shares simultaneous store lookups, then requests fresh data on the next visit', () => {
    const bodies: unknown[] = [];
    http.get(url('/store/categories')).subscribe(body => bodies.push(body));
    http.get(url('/store/categories')).subscribe(body => bodies.push(body));
    backend.expectOne(url('/store/categories')).flush([{ code: 'ceramic', count: 4 }]);
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toEqual(bodies[1]);
    expect(bodies[0]).not.toBe(bodies[1]);
    http.get(url('/store/categories')).subscribe(body => bodies.push(body));
    backend.expectOne(url('/store/categories')).flush([{ code: 'ceramic', count: 5 }]);
    expect(bodies[2]).toEqual([{ code: 'ceramic', count: 5 }]);
  });

  it('keeps the existing catalog cache and isolates consumer mutations', () => {
    let second: unknown;
    http.get<{ name: string }[]>(url('/catalog/eras')).subscribe(body => body[0].name = 'modified locally');
    http.get(url('/catalog/eras')).subscribe(body => second = body);
    backend.expectOne(url('/catalog/eras')).flush([{ name: '清' }]);
    expect(second).toEqual([{ name: '清' }]);
    http.get(url('/catalog/eras')).subscribe(body => expect(body).toEqual([{ name: '清' }]));
    backend.expectNone(url('/catalog/eras'));
  });

  it('does not share or cache member balances', () => {
    http.get(url('/me/economy')).subscribe();
    http.get(url('/me/economy')).subscribe();
    const requests = backend.match(url('/me/economy'));
    expect(requests).toHaveLength(2);
    requests.forEach(request => request.flush({ pointBalance: 1 }));
  });

  it('retries a failed lookup without replaying the failure', () => {
    const errors: number[] = [];
    http.get(url('/catalog/categories')).subscribe({ error: error => errors.push(error.status) });
    http.get(url('/catalog/categories')).subscribe({ error: error => errors.push(error.status) });
    backend.expectOne(url('/catalog/categories')).flush({}, { status: 503, statusText: 'Unavailable' });
    expect(errors).toEqual([503, 503]);
    http.get(url('/catalog/categories')).subscribe();
    backend.expectOne(url('/catalog/categories')).flush([]);
  });

  it('keeps the request alive for remaining consumers and releases fully cancelled requests', () => {
    const first = http.get(url('/store/eras')).subscribe();
    let result: unknown;
    http.get(url('/store/eras')).subscribe(body => result = body);
    const request = backend.expectOne(url('/store/eras'));
    first.unsubscribe();
    expect(request.cancelled).toBe(false);
    request.flush([{ code: 'QING' }]);
    expect(result).toEqual([{ code: 'QING' }]);

    const cancelled = http.get(url('/store/eras')).subscribe();
    const pending = backend.expectOne(url('/store/eras'));
    cancelled.unsubscribe();
    expect(pending.cancelled).toBe(true);
    http.get(url('/store/eras')).subscribe();
    backend.expectOne(url('/store/eras')).flush([]);
  });
});
