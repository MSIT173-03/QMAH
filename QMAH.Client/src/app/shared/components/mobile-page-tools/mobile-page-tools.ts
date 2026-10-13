import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, ElementRef, HostListener, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { GameFocusMode } from '../../../core/services/game-focus-mode';
import { PageReadiness } from '../../../core/services/page-readiness';
import { LucideList, LucideX } from '@lucide/angular';

interface PageToolTarget { selector: string; label: string; }

@Component({
  selector: 'app-mobile-page-tools',
  imports: [LucideList, LucideX],
  templateUrl: './mobile-page-tools.html',
  styleUrl: './mobile-page-tools.scss',
})
export class MobilePageTools {
  readonly gameFocus = inject(GameFocusMode);
  readonly readiness = inject(PageReadiness);
  readonly open = signal(false);
  readonly sections = signal<PageToolTarget[]>([]);
  readonly hasNavigation = signal(false);
  readonly topColors = signal({ background: '', text: '' });
  private readonly router = inject(Router);
  private readonly path = signal(this.router.url);
  readonly useful = computed(() => !/^\/(game|artifact-list|key-list)(\/|\?|$)/.test(this.path()));
  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  @ViewChild('trigger') private trigger?: ElementRef<HTMLButtonElement>;
  private dockFrame: number | null = null;

  constructor() {
    effect(() => { if (!this.readiness.loading()) this.updateDock(); });
    this.router.events.pipe(filter(event => event instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(event => { this.path.set(event.urlAfterRedirects); this.close(false); this.updateDock(); });
    inject(DestroyRef).onDestroy(() => {
      if (this.dockFrame !== null) this.document.defaultView?.cancelAnimationFrame(this.dockFrame);
      this.document.documentElement.style.removeProperty('--qmah-mobile-footer-lift');
      this.document.documentElement.style.removeProperty('--qmah-mobile-tools-visibility');
    });
  }

  toggle(): void {
    if (this.open()) return this.close();
    const scope = this.document.querySelector('.app-main') ?? this.document.documentElement;
    const colors = this.document.defaultView?.getComputedStyle(scope);
    this.topColors.set({
      background: colors?.getPropertyValue('--color-primary').trim() || colors?.getPropertyValue('--qmah-primary').trim() || '',
      text: colors?.getPropertyValue('--color-primary-content').trim() || colors?.getPropertyValue('--qmah-primary-content').trim() || '',
    });
    const candidates: PageToolTarget[] = [
      { selector: '#social-boards', label: '切換看板' },
      { selector: '#social-post-search', label: '搜尋與篩選' },
      { selector: '#social-posts', label: '貼文列表' },
      { selector: '#store-categories', label: '商品分類' },
      { selector: '#store-eras', label: '年代選藏' },
      { selector: '#store-ranking', label: '熱銷排行' },
      { selector: '#store-new-arrivals', label: '新品上架' },
      { selector: '#store-recommendations', label: '為你推薦' },
      { selector: '.mobile-catalog-tabs, .filter-bar', label: '分類與篩選' },
      { selector: '.craft-panel, .craft-center', label: '鑰匙合成台' },
      { selector: '.guide-tabs, .mode-list', label: '遊戲模式' },
      { selector: '.home-explore', label: '功能入口' },
      { selector: '.home-museum-note', label: '院區介紹' },
      { selector: '.login-card, .register-card, .forgot-card', label: '帳號表單' },
      { selector: '.museum-controls', label: '畫卷鑑賞' },
      { selector: 'app-search-bar', label: '商品搜尋' },
      { selector: '.spec-list', label: '商品規格' },
    ];
    this.sections.set(candidates.filter(item => this.region(item.selector)));
    this.hasNavigation.set(!!this.document.querySelector('.app-menu-toggle'));
    this.open.set(true);
  }

  close(restoreFocus = true): void {
    if (!this.open()) return;
    // Move focus before removing a focused action from the panel.
    if (restoreFocus) this.trigger?.nativeElement.focus({ preventScroll: true });
    this.open.set(false);
  }

  top(): void {
    this.close();
    this.document.defaultView?.scrollTo({ top: 0, behavior: this.scrollBehavior() });
  }

  navigate(): void {
    this.close();
    (this.document.querySelector('.app-menu-toggle') as HTMLButtonElement | null)?.click();
  }

  jump(item: PageToolTarget): void {
    const target = this.region(item.selector);
    this.close();
    if (!target) return;
    const view = this.document.defaultView;
    const header = this.document.querySelector('.app-header');
    const offset = (header?.getBoundingClientRect().height ?? 0) + 12;
    view?.scrollTo({ top: Math.max(0, target.getBoundingClientRect().top + view.scrollY - offset), behavior: this.scrollBehavior() });
  }

  private region(selector: string): Element | null {
    // Store hosts can contain several nested display:contents wrappers.
    for (const candidate of this.document.querySelectorAll(selector)) {
      let target: Element | null = candidate;
      while (target && !target.getClientRects().length) target = target.firstElementChild;
      if (target?.getBoundingClientRect().height) return target;
    }
    return null;
  }

  private scrollBehavior(): ScrollBehavior {
    return this.document.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  }

  @HostListener('document:pointerdown', ['$event'])
  outside(event: Event): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.close(false);
  }

  @HostListener('document:keydown.escape')
  escape(): void { this.close(); }

  @HostListener('window:resize')
  resized(): void {
    if ((this.document.defaultView?.innerWidth ?? 0) >= 768) {
      const focused = this.document.activeElement as HTMLElement | null;
      if (focused?.closest('app-mobile-page-tools')) focused.blur();
      this.close(false);
    }
    this.updateDock();
  }

  @HostListener('window:scroll')
  updateDock(): void {
    const view = this.document.defaultView;
    if (!view || this.dockFrame !== null) return;
    this.dockFrame = view.requestAnimationFrame(() => {
      this.dockFrame = null;
      const footer = this.document.querySelector('app-site-footer footer');
      const lift = view.innerWidth < 768 && footer ? Math.max(0, view.innerHeight - footer.getBoundingClientRect().top) : 0;
      this.document.documentElement.style.setProperty('--qmah-mobile-footer-lift', `${lift}px`);
      this.document.documentElement.style.setProperty('--qmah-mobile-tools-visibility', lift > view.innerHeight - 252 ? 'hidden' : 'visible');
    });
  }
}
