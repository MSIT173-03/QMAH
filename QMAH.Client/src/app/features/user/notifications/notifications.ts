import {
  ChangeDetectorRef,
  Component,
  OnInit
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
}


type NotificationFilter =
  | 'ALL'
  | 'UNREAD'
  | 'READ';


@Component({
  selector: 'app-notifications',

  imports: [
    CommonModule,
    BackToMember
  ],

  templateUrl: './notifications.html',
  styleUrl: './notifications.scss'
})
export class Notifications implements OnInit {

  notifications: NotificationDto[] = [];

  loading = true;
  errorMessage = '';

  page = 1;
  pageSize = 20;
  totalCount = 0;
  totalPages = 0;

  readingId: string | null = null;

  selectedFilter: NotificationFilter = 'ALL';


  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }


  ngOnInit(): void {
    this.loadNotifications();
  }


  // ===============================
  // Statistics
  // ===============================

  get unreadCount(): number {

    return this.notifications.filter(
      notification => !notification.isRead
    ).length;

  }


  get readCount(): number {

    return this.notifications.filter(
      notification => notification.isRead
    ).length;

  }


  // ===============================
  // Filter
  // ===============================

  get filteredNotifications(): NotificationDto[] {

    switch (this.selectedFilter) {

      case 'UNREAD':

        return this.notifications.filter(
          notification => !notification.isRead
        );


      case 'READ':

        return this.notifications.filter(
          notification => notification.isRead
        );


      default:

        return this.notifications;

    }

  }


  get selectedFilterLabel(): string {

    switch (this.selectedFilter) {

      case 'UNREAD':
        return '本頁未讀';

      case 'READ':
        return '本頁已讀';

      default:
        return '全部';

    }

  }


  selectFilter(
    filter: NotificationFilter
  ): void {

    this.selectedFilter = filter;

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

    this.selectedFilter = 'ALL';

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

    this.selectedFilter = 'ALL';

    this.loadNotifications();

    this.scrollToTop();

  }


  // ===============================
  // Load
  // ===============================

  loadNotifications(): void {

    this.loading = true;
    this.errorMessage = '';

    this.http
      .get<NotificationPage>(
        '/api/v1/me/notifications',
        {
          params: {
            page: this.page,
            pageSize: this.pageSize
          }
        }
      )
      .subscribe({

        next: (
          data: NotificationPage
        ) => {

          console.log(
            'notifications:',
            data
          );

          this.notifications =
            data.items ?? [];

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

          console.error(
            'notifications error:',
            error
          );

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

    this.http
      .post(
        `/api/v1/me/notifications/${notification.id}/read`,
        {}
      )
      .subscribe({

        next: () => {

          notification.isRead = true;

          notification.readAt =
            new Date().toISOString();

          this.readingId = null;

          this.cdr.detectChanges();

        },

        error: (error) => {

          console.error(
            'mark notification as read error:',
            error
          );

          this.readingId = null;

          this.cdr.detectChanges();

        }

      });

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

    if (!notification.targetUrl) {
      return;
    }

    const targetUrl =
      notification.targetUrl;

    this.readingId =
      notification.id;

    this.http
      .post(
        `/api/v1/me/notifications/${notification.id}/read`,
        {}
      )
      .subscribe({

        next: () => {

          notification.isRead = true;

          notification.readAt =
            new Date().toISOString();

          this.readingId = null;

          this.cdr.detectChanges();

          this.navigateToTarget(
            targetUrl
          );

        },

        error: (error) => {

          console.error(
            'mark notification as read error:',
            error
          );

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
  ): string {

    if (!notification.isRead) {
      return '🔔';
    }

    return '✓';

  }


  private scrollToTop(): void {

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

  }

}
