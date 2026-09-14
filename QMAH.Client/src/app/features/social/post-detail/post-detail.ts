import { Component, Input, OnChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { CreateSocialCommentRequest, SocialApiService, SocialPostDetails } from '../../../core/services/social-api';

@Component({
  selector: 'app-post-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './post-detail.html',
  styleUrl: './post-detail.scss'
})
export class PostDetailComponent implements OnChanges {
  // 路由參數 :id 由 app.config.ts 的 withComponentInputBinding() 自動綁定
  @Input() id!: string;

  private socialApi = inject(SocialApiService);

  post: SocialPostDetails | null = null;
  loading = false;
  loadError: string | null = null;
  actionError: string | null = null;
  newComment: CreateSocialCommentRequest = { content: '' };

  ngOnChanges(): void {
    if (this.id) this.loadPost();
  }

  // GET /api/v1/social/posts/{id}（AllowAnonymous）
  loadPost(): void {
    this.loading = true;
    this.loadError = null;
    this.socialApi.getPost(this.id).subscribe({
      next: (post) => {
        this.post = post;
        this.loading = false;
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.loadError = err.status === 404 ? '這篇貼文不存在或已被下架。' : '取得貼文失敗，請稍後再試。';
        console.error('取得貼文詳情失敗:', err);
      }
    });
  }

  // POST /api/v1/social/posts/{id}/comments（需要登入）
  submitComment(): void {
    if (!this.post || !this.newComment.content.trim()) return;
    this.actionError = null;
    this.socialApi.createComment(this.post.id, this.newComment).subscribe({
      next: () => {
        this.newComment = { content: '' };
        this.loadPost();
      },
      error: (err: HttpErrorResponse) => {
        this.actionError = err.status === 401 ? '請先登入才能留言。' : '留言失敗，請稍後再試。';
        console.error('留言失敗:', err);
      }
    });
  }

  reportPost(): void {
    if (!this.post) return;
    this.submitReport('POST', this.post.id, '已成功檢舉這篇貼文');
  }

  reportComment(commentId: string): void {
    this.submitReport('COMMENT', commentId, '已成功檢舉這則留言');
  }

  private submitReport(targetType: 'POST' | 'COMMENT', targetId: string, successMessage: string): void {
    this.socialApi.createReport({ targetType, targetId, reason: '使用者檢舉' }).subscribe({
      next: () => alert(successMessage),
      error: (err: HttpErrorResponse) => {
        console.error('檢舉失敗:', err);
        alert(err.status === 401 ? '請先登入才能檢舉。' : '檢舉失敗，請稍後再試。');
      }
    });
  }
}
