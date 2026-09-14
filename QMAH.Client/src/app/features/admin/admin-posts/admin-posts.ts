import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { AdminPostListItem, SocialApiService } from '../../../core/services/social-api';

@Component({
  selector: 'app-admin-posts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-posts.html',
  styleUrl: './admin-posts.scss'
})
export class AdminPostsComponent implements OnInit {
  private socialApi = inject(SocialApiService);

  posts: AdminPostListItem[] = [];
  totalCount = 0;
  loadError: string | null = null;
  actionError: string | null = null;
  actionPendingId: string | null = null;

  filterStatus = '';
  filterBoardCode = '';
  filterPostType = '';
  filterKeyword = '';

  ngOnInit(): void {
    this.loadPosts();
  }

  // GET /api/v1/admin/posts?status=&boardCode=&postType=&q=（都留空就回傳全部貼文，不限狀態）
  loadPosts(): void {
    this.loadError = null;
    this.socialApi
      .getAdminPosts({
        status: this.filterStatus || undefined,
        boardCode: this.filterBoardCode || undefined,
        postType: this.filterPostType || undefined,
        q: this.filterKeyword || undefined,
        pageSize: 50
      })
      .subscribe({
        next: (page) => {
          this.posts = page.items;
          this.totalCount = page.totalCount;
        },
        error: (err: HttpErrorResponse) => {
          this.loadError = this.describeError(err, '取得貼文列表');
          console.error('取得貼文列表失敗:', err);
        }
      });
  }

  resetFilters(): void {
    this.filterStatus = '';
    this.filterBoardCode = '';
    this.filterPostType = '';
    this.filterKeyword = '';
    this.loadPosts();
  }

  // PUT /api/v1/admin/posts/:id/status
  setStatus(id: string, status: 'PUBLISHED' | 'HIDDEN' | 'DELETED'): void {
    this.actionError = null;
    this.actionPendingId = id;
    this.socialApi.updatePostStatus(id, { status }).subscribe({
      next: () => {
        this.actionPendingId = null;
        this.loadPosts();
      },
      error: (err: HttpErrorResponse) => {
        this.actionPendingId = null;
        this.actionError = err.status === 409
          ? '這篇貼文是活動的社群入口，請到活動管理調整審核／發布狀態。'
          : this.describeError(err, '變更貼文狀態');
        console.error('變更貼文狀態失敗:', err);
      }
    });
  }

  private describeError(err: HttpErrorResponse, action: string): string {
    if (err.status === 401) return `${action}失敗：請先登入。`;
    if (err.status === 403) return `${action}失敗：目前帳號沒有管理員權限。`;
    return `${action}失敗，請稍後再試。`;
  }
}
