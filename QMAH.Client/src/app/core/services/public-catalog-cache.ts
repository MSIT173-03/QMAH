import { Injectable, inject } from '@angular/core';
import { HttpEvent, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { Observable, finalize, map, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Short-lived public reference data only; member state always comes from the API. */
@Injectable({ providedIn: 'root' })
class PublicCatalogCache {
  readonly entries = new Map<string, { expires: number; response: HttpResponse<unknown> }>();
  readonly pending = new Map<string, Observable<HttpEvent<unknown>>>();
}

export const publicCatalogCacheInterceptor: HttpInterceptorFn = (request, next) => {
  const path = request.url.slice(environment.apiBaseUrl.length);
  const cacheable = /^\/catalog\/(artifacts|categories|eras)$/.test(path);
  const storeReference = /^\/store\/(categories|eras)$/.test(path);
  if (request.method !== 'GET' || !request.url.startsWith(environment.apiBaseUrl) || (!cacheable && !storeReference)) return next(request);
  const { entries, pending } = inject(PublicCatalogCache);
  const now = Date.now();
  for (const [key, entry] of entries) if (entry.expires <= now) entries.delete(key);
  const cached = entries.get(request.urlWithParams);
  if (cached) return of(cached.response.clone({ body: structuredClone(cached.response.body) }));
  let shared = pending.get(request.urlWithParams);
  if (!shared) {
    shared = next(request).pipe(
      tap({ next: event => {
        if (event instanceof HttpResponse && pending.get(request.urlWithParams) === shared) pending.delete(request.urlWithParams);
        // Preserve the existing catalog TTL. Store lookups only share requests
        // currently in flight, so navigating back still gets fresh counts.
        if (!cacheable || !(event instanceof HttpResponse) || !event.ok) return;
        if (entries.size >= 100) entries.delete(entries.keys().next().value!);
        entries.set(request.urlWithParams, { expires: Date.now() + 300_000, response: event.clone({ body: structuredClone(event.body) }) });
      }, error: () => {
        if (pending.get(request.urlWithParams) === shared) pending.delete(request.urlWithParams);
      } }),
      finalize(() => {
        if (pending.get(request.urlWithParams) === shared) pending.delete(request.urlWithParams);
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    pending.set(request.urlWithParams, shared);
  }
  // Each consumer keeps its own response body, just as with independent GETs.
  return shared.pipe(map(event => event instanceof HttpResponse
    ? event.clone({ body: structuredClone(event.body) }) : event));
};
