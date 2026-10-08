import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { ThemeService } from '../../../core/services/theme';
import { GameFocusMode } from '../../../core/services/game-focus-mode';
import { MeApiService } from '../../../core/services/me-api';
import { NotificationsBellComponent } from '../notifications-bell/notifications-bell';
import { ToastContainerComponent } from '../toast-container/toast-container';
import { SiteFooter } from '../site-footer/site-footer';
import { AreaNavigationComponent } from '../area-navigation/area-navigation';
import { QmahIconComponent } from '../qmah-icon/qmah-icon';
import { ScrollTop } from '../../../store/component/scroll-top/scroll-top';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [ScrollTop, RouterOutlet, RouterLink, RouterLinkActive, NotificationsBellComponent, ToastContainerComponent, SiteFooter, AreaNavigationComponent, QmahIconComponent],
  templateUrl: './layout.html',
  styleUrl: './layout.scss'
})
export class LayoutComponent implements OnInit, OnDestroy {
  readonly meApi = inject(MeApiService);
  readonly themeService = inject(ThemeService);
  readonly gameFocus = inject(GameFocusMode);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private routeSubscription: Subscription | null = null;

  readonly menuOpen = signal(false);
  readonly accountOpen = signal(false);
  readonly loggingOut = signal(false);
  readonly failedAvatarPath = signal<string | null>(null);
  readonly currentUrl = signal(this.router.url);
  readonly isAdmin = computed(() => this.meApi.me()?.roles.includes('Admin') ?? false);
  readonly adminEntryUrl = `${environment.apiBaseUrl}/navigation/admin`;
  @ViewChild('menuTrigger') private menuTrigger?: ElementRef<HTMLButtonElement>;
  @ViewChild('mobileNavigation') private mobileNavigation?: ElementRef<HTMLElement>;
  @ViewChild('siteSwitchDialog') private siteSwitchDialog?: ElementRef<HTMLDialogElement>;

  toggleAccount(): void { this.accountOpen.update(open => !open); }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (this.accountOpen() && !(event.target as HTMLElement).closest('.app-account-wrap')) this.accountOpen.set(false);
  }

  confirmAdminNavigation(event: MouseEvent): void {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const dialog = this.siteSwitchDialog?.nativeElement;
    // 原始連結是可用的備援；不支援 dialog 時仍能前往後台。
    if (!dialog || typeof dialog.showModal !== 'function') return;
    this.closeMenu(false);
    try {
      if (!dialog.open) dialog.showModal();
    } catch {
      return;
    }
    event.preventDefault();
  }

  closeSiteSwitch(): void {
    this.siteSwitchDialog?.nativeElement.close();
  }

  onSiteSwitchBackdropClick(event: MouseEvent): void {
    // Angular 將回傳 false 的 click handler 視為 preventDefault；內部連結必須保留預設導頁。
    if (event.target === event.currentTarget) this.closeSiteSwitch();
  }

  /** 五大前台 Area 共用同一個 Shell，但各自保留主色語意；頁面內元件仍可使用自己的 secondary／semantic token。 */
  readonly activeArea = computed<'home' | 'user' | 'catalog' | 'game' | 'social' | 'store'>(() => {
    const url = this.currentUrl().split('?')[0];
    if (url.startsWith('/member') || url.startsWith('/key-list')) return 'user';
    if (url.startsWith('/artifact-list')) return 'catalog';
    if (url.startsWith('/game')) return 'game';
    if (url.startsWith('/social')) return 'social';
    if (url.startsWith('/store')) return 'store';
    return 'home';
  });
  readonly logoSrc = computed(() => this.themeService.theme() === 'qmahdark'
    ? '/images/brand/qmah-logo-dark.svg'
    : '/images/brand/qmah-logo.svg');
  readonly showFixedScrollTop = computed(() => {
    const path = this.currentUrl().split(/[?#]/)[0];
    return this.activeArea() === 'social' || path === '/terms' || path === '/privacy-policy';
  });

  onAvatarError(path: string): void {
    this.failedAvatarPath.set(path);
  }

  ngOnInit(): void {
    this.meApi.refresh();

    // ui-integration: 跨 Area 或 Detail 導航後自動收起 Mobile drawer，避免新頁面仍被前一頁選單遮住。
    this.routeSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.currentUrl.set(event.urlAfterRedirects);
        if (!event.urlAfterRedirects.startsWith('/game')) this.gameFocus.exit();
        this.closeMenu();
      });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
  }

  toggleMenu(): void {
    if (this.menuOpen()) this.closeMenu();
    else {
      this.menuOpen.set(true);
      setTimeout(() => this.focusFirstDrawerControl(), 0);
    }
  }

  // ui-integration: Drawer 開啟後把焦點交給第一個入口，讓鍵盤使用者能直接開始瀏覽主要功能。
  private focusFirstDrawerControl(): void {
    if (!this.menuOpen()) return;

    const drawer = this.mobileNavigation?.nativeElement;
    const firstFocusable = drawer?.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
    );
    firstFocusable?.focus();
  }

  closeMenu(restoreFocus = true): void {
    const restoreDrawerFocus = restoreFocus && this.menuOpen();
    this.menuOpen.set(false);
    this.accountOpen.set(false);
    if (restoreDrawerFocus) setTimeout(() => this.menuTrigger?.nativeElement.focus(), 0);
  }

  // ui-integration: Drawer 使用 Escape 關閉，讓鍵盤使用者不必依賴滑鼠點擊遮罩。
  @HostListener('document:keydown.escape')
  closeMenuWithEscape(): void {
    this.accountOpen.set(false);
    if (this.siteSwitchDialog?.nativeElement.open) return;
    if (this.menuOpen()) this.closeMenu();
  }

  // ui-integration: Mobile drawer 開啟時把 Tab 限制在選單內，關閉後把焦點還給觸發按鈕。
  @HostListener('document:keydown', ['$event'])
  keepFocusInsideDrawer(event: KeyboardEvent): void {
    if (this.siteSwitchDialog?.nativeElement.open) return;
    if (!this.menuOpen() || event.key !== 'Tab') return;
    const drawer = this.mobileNavigation?.nativeElement;
    if (!drawer) return;
    const focusable = Array.from(drawer.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  // ui-integration: 登出集中在 App Shell，避免每個 Area 維護不同的登出行為與失敗狀態。
  logout(): void {
    if (this.loggingOut()) return;

    this.loggingOut.set(true);
    this.auth.logout().subscribe({
      next: () => this.finishLogout(),
      error: () => {
        this.auth.clearSession();
        this.finishLogout();
      }
    });
  }

  private finishLogout(): void {
    this.meApi.clear();
    this.failedAvatarPath.set(null);
    this.loggingOut.set(false);
    this.closeMenu();
    void this.router.navigate(['/login']);
  }
}
