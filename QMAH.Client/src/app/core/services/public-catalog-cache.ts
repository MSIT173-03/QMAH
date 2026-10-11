import { Injectable, inject } from '@angular/core';
import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Short-lived public reference data only; member state always comes from the API. */
@Injectable({ providedIn: 'root' })
class PublicCatalogCache {
  readonly entries = new Map<string, { expires: number; response: HttpResponse<unknown> }>();
}

export const publicCatalogCacheInterceptor: HttpInterceptorFn = (request, next) => {
  const path = request.url.slice(environment.apiBaseUrl.length);
  if (request.method !== 'GET' || !request.url.startsWith(environment.apiBaseUrl) || !/^\/catalog\/(artifacts|categories|eras)$/.test(path)) return next(request);
  const entries = inject(PublicCatalogCache).entries;
  const now = Date.now();
  for (const [key, entry] of entries) if (entry.expires <= now) entries.delete(key);
  const cached = entries.get(request.urlWithParams);
  if (cached) return of(cached.response.clone({ body: structuredClone(cached.response.body) }));
  return next(request).pipe(tap(event => {
    if (!(event instanceof HttpResponse) || !event.ok) return;
    if (entries.size >= 100) entries.delete(entries.keys().next().value!);
    entries.set(request.urlWithParams, { expires: Date.now() + 60_000, response: event.clone({ body: structuredClone(event.body) }) });
  }));
};
