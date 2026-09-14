import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { AdminEventListItem, SocialApiService } from '../../../core/services/social-api';

@Component({
  selector: 'app-admin-events',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-events.html',
  styleUrl: './admin-events.scss'
})
export class AdminEventsComponent implements OnInit {
  private socialApi = inject(SocialApiService);

  events: AdminEventListItem[] = [];
  totalCount = 0;
  loadError: string | null = null;
  actionError: string | null = null;
  actionPendingId: string | null = null;

  filterReviewStatus = '';
  filterPublishStatus = '';
  filterKeyword = '';

  ngOnInit(): void {
    this.loadEvents();
  }

  // GET /api/v1/admin/events?reviewStatus=&publishStatus=&q=（都留空就回傳全部活動）
  loadEvents(): void {
    this.loadError = null;
    this.socialApi
      .getAdminEvents({
        reviewStatus: this.filterReviewStatus || undefined,
        publishStatus: this.filterPublishStatus || undefined,
        q: this.filterKeyword || undefined,
        pageSize: 50
      })
      .subscribe({
        next: (page) => {
          this.events = page.items;
          this.totalCount = page.totalCount;
        },
        error: (err: HttpErrorResponse) => {
          this.loadError = this.describeError(err, '取得活動列表');
          console.error('取得活動列表失敗:', err);
        }
      });
  }

  resetFilters(): void {
    this.filterReviewStatus = '';
    this.filterPublishStatus = '';
    this.filterKeyword = '';
    this.loadEvents();
  }

  // PUT /api/v1/admin/events/:id/review
  review(id: string, status: 'APPROVED' | 'REJECTED'): void {
    this.actionError = null;
    this.actionPendingId = id;
    this.socialApi.reviewEvent(id, { reviewStatus: status }).subscribe({
      next: () => {
        this.actionPendingId = null;
        this.loadEvents();
      },
      error: (err: HttpErrorResponse) => {
        this.actionPendingId = null;
        this.actionError = this.describeError(err, '審核活動');
        console.error('審核失敗:', err);
      }
    });
  }

  // PUT /api/v1/admin/events/:id/publish-status——已審核過的活動可以直接切換發布/下架
  setPublishStatus(id: string, publishStatus: 'PUBLISHED' | 'CANCELLED' | 'DRAFT'): void {
    this.actionError = null;
    this.actionPendingId = id;
    this.socialApi.setEventPublishStatus(id, { publishStatus }).subscribe({
      next: () => {
        this.actionPendingId = null;
        this.loadEvents();
      },
      error: (err: HttpErrorResponse) => {
        this.actionPendingId = null;
        this.actionError = this.describeError(err, '變更發布狀態');
        console.error('變更發布狀態失敗:', err);
      }
    });
  }

  private describeError(err: HttpErrorResponse, action: string): string {
    if (err.status === 401) return `${action}失敗：請先登入。`;
    if (err.status === 403) return `${action}失敗：目前帳號沒有管理員權限。`;
    return `${action}失敗，請稍後再試。`;
  }
}
