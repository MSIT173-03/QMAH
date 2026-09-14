import {
  ChangeDetectorRef,
  Component,
  OnInit
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

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

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadNotifications();
  }

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

        next: (data: NotificationPage) => {

          console.log(
            'notifications:',
            data
          );

          this.notifications = data.items;
          this.page = data.page;
          this.pageSize = data.pageSize;
          this.totalCount = data.totalCount;
          this.totalPages = data.totalPages;

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

  markAsRead(notification: NotificationDto): void {

    if (notification.isRead) {
      return;
    }

    this.readingId = notification.id;

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
}
