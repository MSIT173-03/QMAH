import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, NgZone, inject, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

/** Wait for a route's first presentation. Background refreshes never cover an active page. */
@Injectable({ providedIn: 'root' })
export class PageReadiness {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly zone = inject(NgZone);
  readonly loading = signal(false);
  readonly hasShell = signal(false);
  private host?: HTMLElement;
  private epoch = 0;
  private pending = 0;
  private navigationDone = false;
  private settleTimer?: ReturnType<typeof setTimeout>;
  private deadline?: ReturnType<typeof setTimeout>;

  constructor() {
    this.begin();
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => {
      if (event instanceof NavigationStart) this.begin();
      if (event instanceof NavigationEnd) {
        this.navigationDone = true;
        this.settle();
      }
      if (event instanceof NavigationCancel) this.finish(false);
      if (event instanceof NavigationError) this.finish();
    });
    this.destroyRef.onDestroy(() => this.finish());
  }

  attach(host: HTMLElement): void {
    this.host = host;
    // The shell attaches in AfterViewInit; publish to the parent after that render.
    queueMicrotask(() => { if (this.host === host && host.isConnected) this.hasShell.set(true); });
    this.document.getElementById('qmah-boot-loader')?.remove();
    this.settle();
  }

  detach(host?: HTMLElement): void {
    if (this.host !== host) return;
    this.host = undefined;
    this.hasShell.set(false);
  }

  private contentHost(): HTMLElement | undefined {
    return this.host?.isConnected ? this.host : this.document.querySelector<HTMLElement>('app-root > router-outlet + *') ?? undefined;
  }

  private hasPreparedFirstView(): boolean {
    return !!this.contentHost()?.querySelector('[data-qmah-first-view-ready]');
  }

  private later(callback: () => void, delay: number): ReturnType<typeof setTimeout> {
    return this.zone.runOutsideAngular(() => setTimeout(callback, delay));
  }

  track(url: string, method: string): () => void {
    if (!this.loading() || method !== 'GET' || /\/me\/(session|notifications)(?:[/?]|$)|\/antiforgery-token(?:[/?]|$)/.test(url)) return () => undefined;
    const epoch = this.epoch;
    this.pending++;
    clearTimeout(this.settleTimer);
    return () => { if (epoch === this.epoch) { this.pending = Math.max(0, this.pending - 1); this.settle(); } };
  }

  private begin(): void {
    this.finish(false);
    this.epoch++;
    this.pending = 0;
    this.navigationDone = false;
    this.loading.set(true);
    this.deadline = this.later(() => this.finish(), 3000);
  }

  private settle(): void {
    if (!this.loading() || !this.navigationDone || (this.pending && !this.hasPreparedFirstView()) || !this.contentHost()) return;
    clearTimeout(this.settleTimer);
    const epoch = this.epoch;
    this.settleTimer = this.later(() => void this.waitForFirstView(epoch), 16);
  }

  private async waitForFirstView(epoch: number): Promise<void> {
    const host = this.contentHost();
    if (!host || epoch !== this.epoch || (this.pending && !this.hasPreparedFirstView())) return;
    const window = this.document.defaultView;
    const height = window?.innerHeight ?? 900;
    const inFirstView = (element: Element) => { const rect = element.getBoundingClientRect(); return rect.width > 0 && rect.bottom >= 0 && rect.top < height + 120; };
    const images = Array.from(host.querySelectorAll<HTMLImageElement>('img')).filter(inFirstView);
    for (const img of images) img.loading = 'eager';
    const backgrounds = new Set<string>();
    for (const element of [host, ...Array.from(host.querySelectorAll('*')).filter(inFirstView).slice(0, 64)]) {
      for (const pseudo of [null, '::before', '::after']) {
        const style = window?.getComputedStyle(element, pseudo);
        for (const match of (style?.backgroundImage ?? '').matchAll(/url\(["']?([^"')]+)["']?\)/g)) backgrounds.add(match[1]);
      }
    }
    const backgroundImages = Array.from(backgrounds).map(url => { const img = this.document.createElement('img'); img.src = url; return img; });
    await Promise.race([
      Promise.allSettled([
        ...[...images, ...backgroundImages].map(img => img.decode().catch(() => undefined)),
      ]),
      new Promise<void>(resolve => this.later(resolve, 180)),
    ]);
    if (epoch !== this.epoch) return;
    if (this.pending && !this.hasPreparedFirstView()) { this.settle(); return; }
    this.finish();
  }

  private finish(removeBoot = true): void {
    clearTimeout(this.settleTimer);
    clearTimeout(this.deadline);
    this.loading.set(false);
    if (removeBoot) this.document.getElementById('qmah-boot-loader')?.remove();
  }
}
