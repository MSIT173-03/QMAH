import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { DevLoginComponent } from '../../../dev-tools/dev-login/dev-login';
import { MeApiService } from '../../../core/services/me-api';
import { AdminPendingCountsService } from '../../../core/services/admin-pending-counts';
import { NotificationsBellComponent } from '../notifications-bell/notifications-bell';
import { ToastContainerComponent } from '../toast-container/toast-container';

// 跟 notifications-bell 一樣沒有 SignalR/WebSocket，用定時輪詢模擬「待審核數量會即時更新」。
const PENDING_COUNTS_POLL_INTERVAL_MS = 20000;

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, DevLoginComponent, NotificationsBellComponent, ToastContainerComponent],
  templateUrl: './layout.html',
  styleUrl: './layout.scss'
})
export class LayoutComponent implements OnInit, OnDestroy {
  meApi = inject(MeApiService);
  adminPendingCounts = inject(AdminPendingCountsService);

  private pollHandle: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.meApi.refresh();
    this.pollHandle = setInterval(() => this.adminPendingCounts.refresh(), PENDING_COUNTS_POLL_INTERVAL_MS);
  }

  ngOnDestroy(): void {
    if (this.pollHandle) clearInterval(this.pollHandle);
  }
}
