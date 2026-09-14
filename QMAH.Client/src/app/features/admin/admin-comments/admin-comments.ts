import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { AdminCommentListItem, SocialApiService } from '../../../core/services/social-api';

@Component({
  selector: 'app-admin-comments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-comments.html',
  styleUrl: './admin-comments.scss'
})
export class AdminCommentsComponent implements OnInit {
  private socialApi = inject(SocialApiService);

  comments: AdminCommentListItem[] = [];
  totalCount = 0;
  loadError: string | null = null;
  actionError: string | null = null;
  actionPendingId: string | null = null;

  filterStatus = '';
  filterKeyword = '';

  ngOnInit(): void {
    this.loadComments();
  }

  // GET /api/v1/admin/comments?status=&q=（都留空就回傳全部留言，不限狀態）
  loadComments(): void {
    this.loadError = null;
    this.socialApi
      .getAdminComments({
        status: this.filterStatus || undefined,
        q: this.filterKeyword || undefined,
        pageSize: 50
      })
      .subscribe({
        next: (page) => {
          this.comments = page.items;
          this.totalCount = page.totalCount;
        },
        error: (err: HttpErrorResponse) => {
          this.loadError = this.describeError(err, '取得留言列表');
          console.error('取得留言列表失敗:', err);
        }
      });
  }

  resetFilters(): void {
    this.filterStatus = '';
    this.filterKeyword = '';
    this.loadComments();
  }

  // PUT /api/v1/admin/comments/:id/status
  setStatus(id: string, status: 'PUBLISHED' | 'HIDDEN' | 'DELETED'): void {
    this.actionError = null;
    this.actionPendingId = id;
    this.socialApi.updateCommentStatus(id, { status }).subscribe({
      next: () => {
        this.actionPendingId = null;
        this.loadComments();
      },
      error: (err: HttpErrorResponse) => {
        this.actionPendingId = null;
        this.actionError = this.describeError(err, '變更留言狀態');
        console.error('變更留言狀態失敗:', err);
      }
    });
  }

  private describeError(err: HttpErrorResponse, action: string): string {
    if (err.status === 401) return `${action}失敗：請先登入。`;
    if (err.status === 403) return `${action}失敗：目前帳號沒有管理員權限。`;
    return `${action}失敗，請稍後再試。`;
  }
}
