import { finalize, Subject, Subscription, takeUntil } from 'rxjs';
import { MeApiService } from '../../../core/services/me-api';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NotificationLive } from '../../../core/services/notification-live';
import {
  ChangeDetectorRef,
  Component,
  OnInit, DestroyRef, effect, inject
} from '@angular/core';

import {
  CommonModule
} from '@angular/common';

import {
  HttpClient
} from '@angular/common/http';

import {
  Router
} from '@angular/router';

import {
  BackToMember
} from '../../../shared/back-to-member/back-to-member';
import { QmahIconComponent } from '../../../shared/components/qmah-icon/qmah-icon';
import type { QmahIconName } from '../../../shared/components/qmah-icon/qmah-icon';


interface NotificationDto {
  id: string;
  title: string;
  content: string;
  targetUrl: string | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}


interface NotificationPage {
  items: NotificationDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  unreadCount: number;
  readCount: number;
  totalNotificationCount: number;
}


type NotificationFilter =
  | 'ALL'
  | 'UNREAD'
  | 'READ';


@Component({
  selector: 'app-notifications',

  imports: [
    CommonModule,
    BackToMember,
    QmahIconComponent
  ],

  templateUrl: './notifications.html',
  styleUrl: './notifications.scss'
})
export class Notifications implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly live = inject(NotificationLive);
  private readonly sessionChanges = new Subject<void>();
  private pendingRefresh = false;
  private readonly meApi = inject(MeApiService);
  private request?: Subscription;
  private sessionId: string | null = null;
  private generation = 0;
  private loadSequence = 0;
  private readonly sessionEffect = effect(() => {
    const id = this.meApi.me()?.id ?? null;
    if (id === this.sessionId) return;
    this.generation++;
    this.sessionChanges.next();
    this.pendingRefresh = false;
    this.request?.unsubscribe();
    this.sessionId = id;
    this.notifications = [];
    this.loading = false;
    this.readingId = null;
    this.updatingAll = false;
    this.page = 1;
    this.totalCount = this.totalPages = 0;
    this.unreadCount = this.readCount = this.totalNotificationCount = 0;
    this.errorMessage = '';
    this.actionError = '';
    this.selectedFilter = 'ALL';
    this.cdr.markForCheck();
    if (id) this.loadNotifications();
  });


  notifications: NotificationDto[] = [];

  loading = false;
  errorMessage = '';

  page = 1;
  pageSize = 20;
  totalCount = 0;
  totalPages = 0;
  unreadCount = 0;
  readCount = 0;
  totalNotificationCount = 0;

  readingId: string | null = null;
  updatingAll = false;
  actionError = '';

  selectedFilter: NotificationFilter = 'ALL';


  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }


  ngOnInit(): void {
    this.live.changes.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.loading) this.pendingRefresh = true;
      else this.loadNotifications();
    });
  }


  // ===============================
  // Statistics
  // ===============================

  // ===============================
  // Filter
  // ===============================

  get filteredNotifications(): NotificationDto[] {

    switch (this.selectedFilter) {

      case 'UNREAD':
        return this.notifications;


      case 'READ':
        return this.notifications;


      default:

        return this.notifications;

    }

  }


  selectFilter(
    filter: NotificationFilter
  ): void {
    if (this.selectedFilter === filter) return;
    this.selectedFilter = filter;
    this.page = 1;
    this.request?.unsubscribe();
    this.loading = false;
    this.pendingRefresh = false;
    this.loadNotifications();
  }


  // ===============================
  // Pagination
  // ===============================

  get hasPreviousPage(): boolean {

    return this.page > 1;

  }


  get hasNextPage(): boolean {

    return this.page < this.totalPages;

  }


  previousPage(): void {

    if (
      this.loading ||
      !this.hasPreviousPage
    ) {
      return;
    }

    this.page--;

    this.loadNotifications();

    this.scrollToTop();

  }


  nextPage(): void {

    if (
      this.loading ||
      !this.hasNextPage
    ) {
      return;
    }

    this.page++;

    this.loadNotifications();

    this.scrollToTop();

  }


  // ===============================
  // Load
  // ===============================

  loadNotifications(): void {
    if (!this.meApi.me()) return;
    if (this.loading) { this.pendingRefresh = true; return; }
    const generation = this.generation;
    const sequence = ++this.loadSequence;

    this.loading = true;
    this.errorMessage = '';

    this.request = this.http
      .get<NotificationPage>(
        '/api/v1/me/notifications',
        {
          params: {
            page: this.page,
            pageSize: this.pageSize,
            ...(this.selectedFilter === 'ALL' ? {} : { isRead: this.selectedFilter === 'READ' })
          }
        }
      )
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => {
        if (sequence !== this.loadSequence) return;
        this.loading = false;
        if (generation === this.generation && this.pendingRefresh && !this.destroyRef.destroyed) {
          this.pendingRefresh = false;
          this.loadNotifications();
        }
      }))
      .subscribe({

        next: (
          data: NotificationPage
        ) => {

          if (generation !== this.generation) return;
          // integration: 通知內容可能含會員資料，不再於正式流程輸出整包回應。
          // console.log('notifications:', data);

          this.notifications =
            data.items ?? [];
          this.totalNotificationCount = data.totalNotificationCount ?? data.totalCount;
          this.unreadCount = data.unreadCount ?? 0;
          this.readCount = data.readCount ?? 0;

          this.page =
            data.page;

          this.pageSize =
            data.pageSize;

          this.totalCount =
            data.totalCount;

          this.totalPages =
            data.totalPages;

          this.loading = false;

          this.cdr.detectChanges();

        },

        error: (error) => {

          if (generation !== this.generation) return;
          if (error.status === 401 || error.status === 403) { this.notifications = []; this.meApi.clear(); }

          this.errorMessage =
            '讀取通知資料失敗';

          this.loading = false;

          this.cdr.detectChanges();

        }

      });

  }


  // ===============================
  // Mark as read
  // ===============================

  markAsRead(
    notification: NotificationDto
  ): void {

    if (
      notification.isRead ||
      this.readingId === notification.id
    ) {
      return;
    }

    this.readingId =
      notification.id;
    this.actionError = '';

    const generation = this.generation;
    this.http
      .post(
        `/api/v1/me/notifications/${notification.id}/read`,
        {}
      )
      .pipe(takeUntil(this.sessionChanges), takeUntilDestroyed(this.destroyRef))
      .subscribe({

        next: () => {
          if (generation !== this.generation) return;

          this.applyReadState(notification, true);

          this.readingId = null;

          this.cdr.detectChanges();
          this.live.refresh();

        },

        error: () => {
          if (generation !== this.generation) return;
          this.actionError = '標記失敗，請稍後再試。';

          this.readingId = null;

          this.cdr.detectChanges();

        }

      });

  }

  markAsUnread(event: MouseEvent, notification: NotificationDto): void {
    event.stopPropagation();
    if (!notification.isRead || this.readingId === notification.id) return;
    this.readingId = notification.id;
    this.actionError = '';
    const generation = this.generation;
    this.meApi.markNotificationUnread(notification.id).pipe(takeUntil(this.sessionChanges), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        if (generation !== this.generation) return;
        this.applyReadState(notification, false);
        this.readingId = null;
        this.cdr.detectChanges();
        this.live.refresh();
      },
      error: () => {
        if (generation !== this.generation) return;
        this.actionError = '變更失敗，請稍後再試。';
        this.readingId = null;
        this.cdr.detectChanges();
      }
    });
  }

  markAllAsRead(): void {
    if (!this.unreadCount || this.updatingAll) return;
    this.updatingAll = true;
    this.actionError = '';
    const generation = this.generation;
    this.meApi.markAllNotificationsRead().pipe(
      takeUntilDestroyed(this.destroyRef),
      takeUntil(this.sessionChanges),
      finalize(() => { if (generation === this.generation) this.updatingAll = false; })
    ).subscribe({
      next: () => {
        if (generation !== this.generation) return;
        const readAt = new Date().toISOString();
        if (this.selectedFilter === 'UNREAD') {
          this.notifications = [];
          this.totalCount = 0;
          this.totalPages = 0;
          this.page = 1;
        } else {
          this.notifications.forEach(item => { item.isRead = true; item.readAt = readAt; });
        }
        this.readCount += this.unreadCount;
        this.unreadCount = 0;
        this.cdr.detectChanges();
        this.live.refresh();
      },
      error: () => {
        if (generation !== this.generation) return;
        this.actionError = '全部標記失敗，請稍後再試。';
      }
    });
  }

  private applyReadState(notification: NotificationDto, isRead: boolean): void {
    if (notification.isRead === isRead) return;
    notification.isRead = isRead;
    notification.readAt = isRead ? new Date().toISOString() : null;
    this.unreadCount += isRead ? -1 : 1;
    this.readCount += isRead ? 1 : -1;
    if ((this.selectedFilter === 'UNREAD' && isRead) || (this.selectedFilter === 'READ' && !isRead)) {
      this.notifications = this.notifications.filter(item => item.id !== notification.id);
      this.totalCount = Math.max(0, this.totalCount - 1);
      this.totalPages = Math.ceil(this.totalCount / this.pageSize);
      if (this.page > this.totalPages && this.totalPages > 0) this.page = this.totalPages;
      if (this.notifications.length === 0 && this.totalCount > 0) this.loadNotifications();
    }
  }


  // ===============================
  // Target URL
  // ===============================

  openTarget(
    event: MouseEvent,
    notification: NotificationDto
  ): void {

    event.stopPropagation();

    if (!notification.targetUrl) {
      return;
    }


    if (!notification.isRead) {

      this.markAsReadAndNavigate(
        notification
      );

      return;

    }


    this.navigateToTarget(
      notification.targetUrl
    );

  }


  private markAsReadAndNavigate(
    notification: NotificationDto
  ): void {

    if (!notification.targetUrl || this.readingId === notification.id) {
      return;
    }

    const targetUrl =
      notification.targetUrl;

    this.readingId =
      notification.id;

    const generation = this.generation;
    this.http
      .post(
        `/api/v1/me/notifications/${notification.id}/read`,
        {}
      )
      .pipe(takeUntil(this.sessionChanges), takeUntilDestroyed(this.destroyRef))
      .subscribe({

        next: () => {
          if (generation !== this.generation) return;

          this.applyReadState(notification, true);

          this.readingId = null;

          this.cdr.detectChanges();

          this.live.refresh();
          this.navigateToTarget(
            targetUrl
          );

        },

        error: () => {
          if (generation !== this.generation) return;

          this.actionError = '標記失敗，請稍後再試。';

          this.readingId = null;

          this.cdr.detectChanges();

        }

      });

  }


  private navigateToTarget(
    targetUrl: string
  ): void {

    // 站內網址
    if (targetUrl.startsWith('/')) {

      this.router.navigateByUrl(
        targetUrl
      );

      return;

    }


    // 完整網址
    if (
      targetUrl.startsWith('http://') ||
      targetUrl.startsWith('https://')
    ) {

      window.location.href =
        targetUrl;

    }

  }


  // ===============================
  // Helpers
  // ===============================

  getNotificationIcon(
    notification: NotificationDto
  ): QmahIconName {

    if (!notification.isRead) {
      return 'bell';
    }

    return 'check-circle';

  }


  private scrollToTop(): void {

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

  }

}
