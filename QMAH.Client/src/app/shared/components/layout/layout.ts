import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import {
  LucideCalendarCog,
  LucideCalendarDays,
  LucideFileText,
  LucideFlag,
  LucideLibrary,
  LucideMegaphone,
  LucideMessageCircle,
} from '@lucide/angular';
import { AuthService } from '../../../core/auth/auth.service';
import { ThemeService } from '../../../core/services/theme';
import { MeApiService } from '../../../core/services/me-api';
import { AdminPendingCountsService } from '../../../core/services/admin-pending-counts';
import { NotificationsBellComponent } from '../notifications-bell/notifications-bell';
import { ToastContainerComponent } from '../toast-container/toast-container';
import { SiteFooter } from '../site-footer/site-footer';
import { AreaNavigationComponent, NavigationGroup } from '../area-navigation/area-navigation';
import { QmahIconComponent } from '../qmah-icon/qmah-icon';

// 跟 notifications-bell 一樣沒有 SignalR/WebSocket，用定時輪詢模擬「待審核數量會即時更新」。
const PENDING_COUNTS_POLL_INTERVAL_MS = 20000;

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, NotificationsBellComponent, ToastContainerComponent, SiteFooter, AreaNavigationComponent, QmahIconComponent],
  templateUrl: './layout.html',
  styleUrl: './layout.scss'
})
export class LayoutComponent implements OnInit, OnDestroy {
  readonly meApi = inject(MeApiService);
  readonly themeService = inject(ThemeService);
  readonly adminPendingCounts = inject(AdminPendingCountsService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private routeSubscription: Subscription | null = null;

  readonly menuOpen = signal(false);
  readonly loggingOut = signal(false);
  readonly currentUrl = signal(this.router.url);
  @ViewChild('menuTrigger') private menuTrigger?: ElementRef<HTMLButtonElement>;
  @ViewChild('mobileNavigation') private mobileNavigation?: ElementRef<HTMLElement>;

  readonly isAdmin = computed(() => this.meApi.me()?.roles?.includes('Admin') ?? false);

  // ui-integration: Mobile 次級入口集中成資料，讓同一個 drawer 可延伸到 Social／Admin，而不複製 Layout markup。
  readonly mobileNavigationGroups = computed<readonly NavigationGroup[]>(() => {
    const groups: NavigationGroup[] = [
      {
        label: '社群',
        items: [
          { label: '貼文廣場', path: '/social/posts', activePrefixes: ['/social/posts'], icon: LucideLibrary },
          { label: '活動總覽', path: '/social/events', activePrefixes: ['/social/events'], icon: LucideCalendarDays },
          { label: '站方公告', path: '/social/announcements', activePrefixes: ['/social/announcements'], icon: LucideMegaphone }
        ]
      }
    ];

    if (this.isAdmin()) {
      groups.push({
        label: '管理',
        tone: 'admin',
        items: [
          { label: '活動管理', path: '/admin/events', activePrefixes: ['/admin/events'], icon: LucideCalendarCog, badge: this.adminPendingCounts.pendingEventsCount() || undefined },
          { label: '貼文管理', path: '/admin/posts', activePrefixes: ['/admin/posts'], icon: LucideFileText },
          { label: '留言管理', path: '/admin/comments', activePrefixes: ['/admin/comments'], icon: LucideMessageCircle },
          { label: '檢舉審核', path: '/admin/reports', activePrefixes: ['/admin/reports'], icon: LucideFlag, badge: this.adminPendingCounts.pendingReportsCount() || undefined }
        ]
      });
    }

    return groups;
  });

  ngOnInit(): void {
    this.meApi.refresh();
    this.pollHandle = setInterval(() => this.adminPendingCounts.refresh(), PENDING_COUNTS_POLL_INTERVAL_MS);

    // ui-integration: 跨 Area 或 Detail 導航後自動收起 Mobile drawer，避免新頁面仍被前一頁選單遮住。
    this.routeSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.currentUrl.set(event.urlAfterRedirects);
        this.closeMenu();
      });
  }

  readonly isSocialArea = computed(() => this.currentUrl().startsWith('/social'));
  readonly isAdminArea = computed(() => this.currentUrl().startsWith('/admin'));

  ngOnDestroy(): void {
    if (this.pollHandle) clearInterval(this.pollHandle);
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

  closeMenu(): void {
    this.menuOpen.set(false);
    setTimeout(() => this.menuTrigger?.nativeElement.focus(), 0);
  }

  // ui-integration: Drawer 使用 Escape 關閉，讓鍵盤使用者不必依賴滑鼠點擊遮罩。
  @HostListener('document:keydown.escape')
  closeMenuWithEscape(): void {
    if (this.menuOpen()) this.closeMenu();
  }

  // ui-integration: Mobile drawer 開啟時把 Tab 限制在選單內，關閉後把焦點還給觸發按鈕。
  @HostListener('document:keydown', ['$event'])
  keepFocusInsideDrawer(event: KeyboardEvent): void {
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
    this.loggingOut.set(false);
    this.closeMenu();
    void this.router.navigate(['/login']);
  }
}
