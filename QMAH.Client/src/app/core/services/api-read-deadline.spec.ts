import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { apiReadDeadlineInterceptor } from './api-read-deadline';

describe('API read deadline', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [
    provideHttpClient(withInterceptors([apiReadDeadlineInterceptor])), provideHttpClientTesting(),
  ] }));
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); vi.useRealTimers(); });
  it('cancels a stalled read and returns a retryable HTTP error', async () => {
    vi.useFakeTimers();
    const error = vi.fn();
    TestBed.inject(HttpClient).get('/api/v1/social/posts').subscribe({ error });
    const request = TestBed.inject(HttpTestingController).expectOne('/api/v1/social/posts');
    await vi.advanceTimersByTimeAsync(15_000);
    expect(request.cancelled).toBe(true);
    expect(error.mock.calls[0][0].status).toBe(504);
  });
  it('preserves a normal response', () => {
    const result = vi.fn();
    TestBed.inject(HttpClient).get('/api/v1/store/products').subscribe(result);
    TestBed.inject(HttpTestingController).expectOne('/api/v1/store/products').flush({ items: [] });
    expect(result).toHaveBeenCalledWith({ items: [] });
  });
  it('does not cancel or retry checkout writes', async () => {
    vi.useFakeTimers();
    const result = vi.fn();
    TestBed.inject(HttpClient).post('/api/v1/store/checkout', {}).subscribe(result);
    const request = TestBed.inject(HttpTestingController).expectOne('/api/v1/store/checkout');
    await vi.advanceTimersByTimeAsync(16_000);
    expect(request.cancelled).toBe(false);
    request.flush({ ok: true });
    expect(result).toHaveBeenCalledWith({ ok: true });
  });
});
