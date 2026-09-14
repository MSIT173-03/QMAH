import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AdminContentReport, SocialApiService } from '../../../core/services/social-api';

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-reports.html',
  styleUrl: './admin-reports.scss'
})
export class AdminReportsComponent implements OnInit {
  private socialApi = inject(SocialApiService);

  pendingReports: AdminContentReport[] = [];

  ngOnInit(): void {
    this.loadPendingReports();
  }

  // GET /api/v1/admin/reports?status=PENDING（需要 Admin 角色）
  loadPendingReports(): void {
    this.socialApi.getAdminReports({ status: 'PENDING', pageSize: 50 }).subscribe({
      next: (page) => (this.pendingReports = page.items),
      error: (err) => console.error('取得待處理檢舉失敗（請確認已用管理員登入）:', err)
    });
  }

  // PUT /api/v1/admin/reports/:id — 確認違規並隱藏內容
  resolveAndHide(id: string): void {
    this.socialApi.reviewReport(id, { status: 'RESOLVED', contentAction: 'HIDDEN' }).subscribe({
      next: () => {
        alert(`檢舉 ${id} 已確認違規，內容已隱藏`);
        this.loadPendingReports();
      },
      error: (err) => console.error('處理檢舉失敗:', err)
    });
  }

  // PUT /api/v1/admin/reports/:id — 駁回檢舉
  reject(id: string): void {
    this.socialApi.reviewReport(id, { status: 'REJECTED' }).subscribe({
      next: () => {
        alert(`檢舉 ${id} 已駁回`);
        this.loadPendingReports();
      },
      error: (err) => console.error('處理檢舉失敗:', err)
    });
  }
}
