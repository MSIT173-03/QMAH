import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../auth/auth.service';
import { authGuard } from './auth-guard';

describe('authGuard', () => {
  let auth: { getCurrentUser: ReturnType<typeof vi.fn>; currentUser: ReturnType<typeof signal<unknown>>; clearSession: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    auth = { getCurrentUser: vi.fn(() => of({ id: 'member' })), currentUser: signal<unknown>(null), clearSession: vi.fn() };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useValue: auth }] });
  });

  const execute = () => firstValueFrom(TestBed.runInInjectionContext(() =>
    authGuard({} as ActivatedRouteSnapshot, { url: '/store/orders' } as RouterStateSnapshot)) as Observable<boolean | UrlTree>);

  it('allows a user verified by the session API', async () => {
    expect(await execute()).toBe(true);
    expect(auth.clearSession).not.toHaveBeenCalled();
  });

  it.each([401, 403])('clears the cached user and preserves the destination on %s', async status => {
    auth.currentUser.set({ id: 'cached-member' });
    auth.getCurrentUser.mockReturnValue(throwError(() => new HttpErrorResponse({ status })));
    const result = await execute() as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/login?returnUrl=%2Fstore%2Forders');
    expect(auth.clearSession).toHaveBeenCalledOnce();
  });

  it.each([true, false])('only tolerates a temporary outage for an already verified user (%s)', async cached => {
    auth.currentUser.set(cached ? { id: 'cached-member' } : null);
    auth.getCurrentUser.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    const result = await execute();
    if (cached) {
      expect(result).toBe(true);
      expect(auth.clearSession).not.toHaveBeenCalled();
    } else {
      expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login?returnUrl=%2Fstore%2Forders');
      expect(auth.clearSession).toHaveBeenCalledOnce();
    }
  });
});
