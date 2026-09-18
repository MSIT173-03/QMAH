import { Injectable, effect, inject, signal } from '@angular/core';

import { MeApiService } from './me-api';
import { SocialApiService } from './social-api';

// 後台側邊選單用的「待審核數量」：檢舉審核（ContentReports.Status = PENDING）
// 與活動管理（Events.ReviewStatus = PENDING），只查 pageSize=1 拿 totalCount，不用真的把清單抓下來。
// 只有登入且有 Admin 角色才查，避免一般會員也打這兩支 [Authorize(Roles = "Admin")] 的 API 收到 401。
@Injectable({ providedIn: 'root' })
export class AdminPendingCountsService {
  private socialApi = inject(SocialApiService);
  private meApi = inject(MeApiService);

  readonly pendingReportsCount = signal(0);
  readonly pendingEventsCount = signal(0);

  constructor() {
    // meApi.me() 在 dev-login 登入/登出、或 LayoutComponent 呼叫 meApi.refresh() 拿到結果後才會變化，
    // 用 effect 盯著它，一有變化（含剛登入拿到 Admin 角色）就重新查一次，不用等下一次輪詢。
    effect(() => {
      this.meApi.me();
      this.refresh();
    });
  }

  refresh(): void {
    if (!this.meApi.me()?.roles.includes('Admin')) {
      this.pendingReportsCount.set(0);
      this.pendingEventsCount.set(0);
      return;
    }

    this.socialApi.getAdminReports({ status: 'PENDING', pageSize: 1 }).subscribe({
      next: (page) => this.pendingReportsCount.set(page.totalCount),
      error: () => this.pendingReportsCount.set(0)
    });

    this.socialApi.getAdminEvents({ reviewStatus: 'PENDING', pageSize: 1 }).subscribe({
      next: (page) => this.pendingEventsCount.set(page.totalCount),
      error: () => this.pendingEventsCount.set(0)
    });
  }
}
