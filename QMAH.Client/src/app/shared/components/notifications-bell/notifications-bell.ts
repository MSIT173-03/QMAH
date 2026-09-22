import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { MeApiService, UserNotification } from '../../../core/services/me-api';
import { ToastService } from '../../../core/services/toast';
import { QmahIconComponent } from '../qmah-icon/qmah-icon';

// 沒有 SignalR/WebSocket，用定時輪詢模擬「有新通知會跳出來」；20 秒對展示用途已經夠即時。
const POLL_INTERVAL_MS = 20000;

@Component({
  selector: 'app-notifications-bell',
  standalone: true,
  imports: [CommonModule, RouterLink, QmahIconComponent],
  templateUrl: './notifications-bell.html',
  styleUrl: './notifications-bell.scss'
})
export class NotificationsBellComponent implements OnInit, OnDestroy {
  private meApi = inject(MeApiService);
  private toast = inject(ToastService);

  notifications: UserNotification[] = [];
  loggedIn = false;

  private seenIds = new Set<string>();
  private hasLoadedOnce = false;
  private pollHandle: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.load();
    this.pollHandle = setInterval(() => this.load(), POLL_INTERVAL_MS);
  }

  ngOnDestroy(): void {
    if (this.pollHandle) clearInterval(this.pollHandle);
  }

  get unreadCount(): number {
    return this.notifications.filter((notification) => !notification.isRead).length;
  }

  // GET /api/v1/me/notifications（未登入會 401，這裡就當作沒有通知，不彈錯誤）
  load(): void {
    this.meApi.getNotifications({ pageSize: 10 }).subscribe({
      next: (page) => {
        // 第一次載入（剛進頁面／剛登入後第一次抓到資料）不用把既有通知都跳成 toast，
        // 之後輪詢到「上次沒看過的 id」才真的跳出來，模擬即時通知。
        if (this.hasLoadedOnce) {
          for (const notification of page.items) {
            if (!this.seenIds.has(notification.id)) {
              this.toast.show(`通知：${notification.title}`, 'info');
            }
          }
        }
        this.notifications = page.items;
        this.seenIds = new Set(page.items.map((notification) => notification.id));
        this.loggedIn = true;
        this.hasLoadedOnce = true;
      },
      error: () => {
        this.notifications = [];
        this.loggedIn = false;
        this.hasLoadedOnce = true;
      }
    });
  }

  markRead(notification: UserNotification): void {
    if (notification.isRead) return;
    this.meApi.markNotificationRead(notification.id).subscribe({
      next: () => (notification.isRead = true),
      error: (err) => console.error('標記通知已讀失敗:', err)
    });
  }
}
