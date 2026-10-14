import { ChangeDetectorRef, ElementRef, Component, DestroyRef, OnDestroy, OnInit, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, DOCUMENT } from '@angular/common';
import { RouterLink } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { MeApiService, UserNotification } from '../../../core/services/me-api';
import { NotificationLive } from '../../../core/services/notification-live';
import { ToastService } from '../../../core/services/toast';
import { QmahIconComponent } from '../qmah-icon/qmah-icon';

@Component({
  selector: 'app-notifications-bell', standalone: true,
  imports: [CommonModule, RouterLink, QmahIconComponent],
  templateUrl: './notifications-bell.html', styleUrl: './notifications-bell.scss'
})
export class NotificationsBellComponent implements OnInit, OnDestroy {
  private readonly meApi = inject(MeApiService);
  private readonly live = inject(NotificationLive);
  private readonly toast = inject(ToastService);
  private readonly document = inject(DOCUMENT);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject(ElementRef<HTMLElement>);
  open = false;
  notifications: UserNotification[] = [];
  loggedIn = false;
  private seenIds = new Set<string>();
  private hasLoadedOnce = false;
  private loading = false;
  private loadRequest?: Subscription;
  private pending = false;
  private sessionId: string | null = null;
  private generation = 0;
  private totalUnread = 0;
  private readonly readingIds = new Set<string>();
  private readonly sessionEffect = effect(() => {
    const id = this.meApi.me()?.id ?? null;
    if (id === this.sessionId) return;
    this.sessionId = id;
    this.generation++;
    this.pending = false;
    this.loadRequest?.unsubscribe();
    this.loading = false;
    this.readingIds.clear();
    this.notifications = [];
    this.totalUnread = 0;
    this.seenIds.clear();
    this.hasLoadedOnce = false;
    this.loggedIn = false;
    this.changeDetector.markForCheck();
    this.pending = false;
    if (id !== null) this.load();
  });
  // 手機瀏覽器（iOS Safari 等）點按鈕不會取得焦點，改用明確的開關狀態，桌機與手機行為一致。
  private readonly onDocumentPointer = (event: Event) => {
    if (this.open && !this.host.nativeElement.contains(event.target as Node)) { this.open = false; this.changeDetector.markForCheck(); }
  };
  private readonly onVisibilityChange = () => {
    if (this.document.visibilityState !== 'hidden') this.load();
  };

  ngOnInit(): void {
    this.live.changes.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
    this.document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.document.addEventListener('click', this.onDocumentPointer);
  }
  toggle(event: Event): void {
    event.stopPropagation();
    this.open = !this.open;
    if (this.open) this.load();
  }
  onPanelClick(event: Event): void {
    if ((event.target as HTMLElement).closest('a, button')) this.open = false;
  }
  ngOnDestroy(): void {
    this.document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.document.removeEventListener('click', this.onDocumentPointer);
  }
  get unreadCount(): number {
    return this.totalUnread;
  }
  load(): void {
    if (!this.meApi.me()) return;
    if (this.loading) { this.pending = true; return; }
    this.loading = true;
    const generation = this.generation;
    this.loadRequest = this.meApi.getNotifications({ pageSize: 10 }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        this.loading = false;
        if (this.pending && !this.destroyRef.destroyed) { this.pending = false; this.load(); }
      })
    ).subscribe({
      next: page => {
        if (generation !== this.generation) return;
        if (this.hasLoadedOnce) {
          for (const notification of page.items) {
            if (!notification.isRead && !this.seenIds.has(notification.id)) this.toast.show(`通知：${notification.title}`, 'info');
          }
        }
        this.notifications = page.items;
        this.totalUnread = page.unreadCount ?? page.items.filter(item => !item.isRead).length;
        this.seenIds = new Set(page.items.map(notification => notification.id));
        this.loggedIn = true;
        this.hasLoadedOnce = true;
        this.changeDetector.markForCheck();
      },
      error: error => {
        if (generation !== this.generation) return;
        // 網路暫時失敗時保留既有通知；只有登入失效才清除會員資料。
        if (error.status !== 401 && error.status !== 403) return;
        this.notifications = [];
        this.totalUnread = 0;
        this.seenIds.clear();
        this.loggedIn = false;
        this.hasLoadedOnce = false;
        this.meApi.clear();
        this.changeDetector.markForCheck();
      }
    });
  }
  markRead(notification: UserNotification): void {
    if (notification.isRead || this.readingIds.has(notification.id)) return;
    const generation = this.generation;
    this.readingIds.add(notification.id);
    this.meApi.markNotificationRead(notification.id).pipe(takeUntilDestroyed(this.destroyRef),
      finalize(() => this.readingIds.delete(notification.id))).subscribe({
      next: () => {
        if (generation !== this.generation) return;
        notification.isRead = true;
        this.totalUnread = Math.max(0, this.totalUnread - 1);
        this.live.refresh();
        this.changeDetector.markForCheck();
      },
      error: () => this.toast.show('暫時無法標記已讀，請稍後再試。', 'info')
    });
  }
}
