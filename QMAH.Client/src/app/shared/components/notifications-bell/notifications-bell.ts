import { ChangeDetectorRef, Component, DestroyRef, OnDestroy, OnInit, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, DOCUMENT } from '@angular/common';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
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
  notifications: UserNotification[] = [];
  loggedIn = false;
  private seenIds = new Set<string>();
  private hasLoadedOnce = false;
  private loading = false;
  private pending = false;
  private sessionId: string | null = null;
  private generation = 0;
  private readonly sessionEffect = effect(() => {
    const id = this.meApi.me()?.id ?? null;
    if (id === this.sessionId) return;
    const previousId = this.sessionId;
    this.sessionId = id;
    // 首次確認會員身分時，保留同一登入階段已送出的初始讀取。
    if (previousId === null && id !== null) return;
    this.generation++;
    this.notifications = [];
    this.seenIds.clear();
    this.hasLoadedOnce = false;
    this.loggedIn = false;
    this.changeDetector.markForCheck();
    this.pending = false;
  });
  private readonly onVisibilityChange = () => {
    if (this.document.visibilityState !== 'hidden') this.load();
  };

  ngOnInit(): void {
    this.load();
    this.live.changes.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
    this.document.addEventListener('visibilitychange', this.onVisibilityChange);
  }
  ngOnDestroy(): void {
    this.document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }
  get unreadCount(): number {
    return this.notifications.filter(notification => !notification.isRead).length;
  }
  load(): void {
    if (this.loading) { this.pending = true; return; }
    this.loading = true;
    const generation = this.generation;
    this.meApi.getNotifications({ pageSize: 10 }).pipe(
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
            if (!this.seenIds.has(notification.id)) this.toast.show(`通知：${notification.title}`, 'info');
          }
        }
        this.notifications = page.items;
        this.seenIds = new Set(page.items.map(notification => notification.id));
        this.loggedIn = true;
        this.hasLoadedOnce = true;
        this.changeDetector.markForCheck();
      },
      error: error => {
        if (generation !== this.generation) return;
        // 網路暫時失敗時保留既有通知；只有登入失效才清除會員資料。
        if (error.status !== 401) return;
        this.notifications = [];
        this.seenIds.clear();
        this.loggedIn = false;
        this.hasLoadedOnce = false;
        this.changeDetector.markForCheck();
      }
    });
  }
  markRead(notification: UserNotification): void {
    if (notification.isRead) return;
    this.meApi.markNotificationRead(notification.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { notification.isRead = true; this.changeDetector.markForCheck(); },
      error: () => this.toast.show('暫時無法標記已讀，請稍後再試。', 'info')
    });
  }
}
