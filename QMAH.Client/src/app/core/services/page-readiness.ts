import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

const MAIN_PAGES = new Set(['/', '/home', '/member', '/artifact-list', '/key-list', '/game', '/game/how-to', '/game/appreciation', '/social/posts', '/social/events', '/store', '/store/products', '/store/coupons', '/store/orders']);

/** Wait for a route's first presentation. Background refreshes never cover an active page. */
@Injectable({ providedIn: 'root' })
export class PageReadiness {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  readonly loading = signal(false);
  private host?: HTMLElement;
  private epoch = 0;
  private pending = 0;
  private navigationDone = false;
  private settleTimer?: ReturnType<typeof setTimeout>;
  private deadline?: ReturnType<typeof setTimeout>;

  constructor() {
    this.begin(this.router.url);
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => {
      if (event instanceof NavigationStart) this.begin(event.url);
      if (event instanceof NavigationEnd) {
        this.navigationDone = true;
        const path = event.urlAfterRedirects.split(/[?#]/)[0].replace(/\/$/, '') || '/';
        if (!MAIN_PAGES.has(path)) this.finish(); else this.settle();
      }
      if (event instanceof NavigationCancel) this.finish(false);
      if (event instanceof NavigationError) this.finish();
    });
    this.destroyRef.onDestroy(() => this.finish());
  }

  attach(host: HTMLElement): void {
    this.host = host;
    this.document.getElementById('qmah-boot-loader')?.remove();
    this.settle();
  }

  track(url: string, method: string): () => void {
    if (!this.loading() || method !== 'GET' || /\/me\/(session|notifications)(?:[/?]|$)|\/antiforgery-token(?:[/?]|$)/.test(url)) return () => undefined;
    const epoch = this.epoch;
    this.pending++;
    clearTimeout(this.settleTimer);
    return () => { if (epoch === this.epoch) { this.pending = Math.max(0, this.pending - 1); this.settle(); } };
  }

  private begin(url: string): void {
    this.finish(false);
    this.epoch++;
    this.pending = 0;
    this.navigationDone = false;
    const path = url.split(/[?#]/)[0].replace(/\/$/, '') || '/';
    this.loading.set(MAIN_PAGES.has(path));
    if (this.loading()) this.deadline = setTimeout(() => this.finish(), 12000);
  }

  private settle(): void {
    if (!this.loading() || !this.navigationDone || this.pending || !this.host?.isConnected) return;
    clearTimeout(this.settleTimer);
    const epoch = this.epoch;
    this.settleTimer = setTimeout(() => void this.waitForFirstView(epoch), 60);
  }

  private async waitForFirstView(epoch: number): Promise<void> {
    if (!this.host?.isConnected || epoch !== this.epoch || this.pending) return;
    const window = this.document.defaultView;
    const height = window?.innerHeight ?? 900;
    const inFirstView = (element: Element) => { const rect = element.getBoundingClientRect(); return rect.width > 0 && rect.bottom >= 0 && rect.top < height + 120; };
    const images = Array.from(this.host.querySelectorAll<HTMLImageElement>('img')).filter(inFirstView);
    for (const img of images) img.loading = 'eager';
    const backgrounds = new Set<string>();
    for (const element of [this.host, ...Array.from(this.host.querySelectorAll('*')).filter(inFirstView).slice(0, 160)]) {
      for (const pseudo of [null, '::before', '::after']) {
        const style = window?.getComputedStyle(element, pseudo);
        for (const match of (style?.backgroundImage ?? '').matchAll(/url\(["']?([^"')]+)["']?\)/g)) backgrounds.add(match[1]);
      }
    }
    const backgroundImages = Array.from(backgrounds).map(url => { const img = this.document.createElement('img'); img.src = url; return img; });
    await Promise.race([
      Promise.allSettled([
        this.document.fonts?.ready ?? Promise.resolve(),
        ...[...images, ...backgroundImages].map(img => img.decode().catch(() => undefined)),
      ]),
      new Promise<void>(resolve => setTimeout(resolve, 650)),
    ]);
    if (epoch !== this.epoch) return;
    if (this.pending) { this.settle(); return; }
    this.finish();
  }

  private finish(removeBoot = true): void {
    clearTimeout(this.settleTimer);
    clearTimeout(this.deadline);
    this.loading.set(false);
    if (removeBoot) this.document.getElementById('qmah-boot-loader')?.remove();
  }
}
