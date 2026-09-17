import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { AdminContentReport, SocialApiService } from '../../../core/services/social-api';

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-reports.html',
  styleUrl: './admin-reports.scss'
})
export class AdminReportsComponent implements OnInit {
  private socialApi = inject(SocialApiService);
  private cdr = inject(ChangeDetectorRef);

  reports: AdminContentReport[] = [];
  totalCount = 0;
  loadError: string | null = null;
  actionError: string | null = null;
  actionPendingId: string | null = null;

  filterStatus = 'PENDING';
  filterKeyword = '';

  ngOnInit(): void {
    this.loadReports();
  }

  // GET /api/v1/admin/reports?status=&q=
  loadReports(): void {
    this.loadError = null;
    this.socialApi
      .getAdminReports({
        status: this.filterStatus || undefined,
        q: this.filterKeyword || undefined,
        pageSize: 50
      })
      .subscribe({
        next: (page) => {
          this.reports = page.items;
          this.totalCount = page.totalCount;
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          this.loadError = this.describeError(err, '取得檢舉列表');
          console.error('取得檢舉列表失敗:', err);
          this.cdr.detectChanges();
        }
      });
  }

  resetFilters(): void {
    this.filterStatus = '';
    this.filterKeyword = '';
    this.loadReports();
  }

  // PUT /api/v1/admin/reports/:id — 確認違規並隱藏內容
  resolveAndHide(id: string): void {
    this.actionError = null;
    this.actionPendingId = id;
    this.socialApi.reviewReport(id, { status: 'RESOLVED', contentAction: 'HIDDEN' }).subscribe({
      next: () => {
        this.actionPendingId = null;
        this.loadReports();
      },
      error: (err: HttpErrorResponse) => {
        this.actionPendingId = null;
        this.actionError = this.describeError(err, '處理檢舉');
        console.error('處理檢舉失敗:', err);
        this.cdr.detectChanges();
      }
    });
  }

  // PUT /api/v1/admin/reports/:id — 駁回檢舉
  reject(id: string): void {
    this.actionError = null;
    this.actionPendingId = id;
    this.socialApi.reviewReport(id, { status: 'REJECTED' }).subscribe({
      next: () => {
        this.actionPendingId = null;
        this.loadReports();
      },
      error: (err: HttpErrorResponse) => {
        this.actionPendingId = null;
        this.actionError = this.describeError(err, '處理檢舉');
        console.error('處理檢舉失敗:', err);
        this.cdr.detectChanges();
      }
    });
  }

  private describeError(err: HttpErrorResponse, action: string): string {
    if (err.status === 401) return `${action}失敗：請先登入。`;
    if (err.status === 403) return `${action}失敗：目前帳號沒有管理員權限。`;
    return `${action}失敗，請稍後再試。`;
  }
}
