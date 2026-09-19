import { ChangeDetectorRef, Component, Input, OnChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { CreateSocialCommentRequest, SocialApiService, SocialComment, SocialPostDetails } from '../../../core/services/social-api';
import { MeApiService } from '../../../core/services/me-api';
import { ReportModalComponent } from '../../../shared/components/report-modal/report-modal';
import { SocialPostContentComponent } from '../../../shared/components/social-post-content/social-post-content';
import { LucideArrowLeft, LucideFlag, LucideMessageCircle, LucidePencil, LucideTrash2, LucideUserRound } from '@lucide/angular';

@Component({
  selector: 'app-post-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ReportModalComponent, SocialPostContentComponent, LucideArrowLeft, LucideFlag, LucideMessageCircle, LucidePencil, LucideTrash2, LucideUserRound],
  templateUrl: './post-detail.html',
  styleUrl: './post-detail.scss'
})
export class PostDetailComponent implements OnChanges {
  // 路由參數 :id 由 app.config.ts 的 withComponentInputBinding() 自動綁定
  @Input() id!: string;

  private socialApi = inject(SocialApiService);
  private meApi = inject(MeApiService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  post: SocialPostDetails | null = null;
  loading = false;
  loadError: string | null = null;
  actionError: string | null = null;
  reportSuccessMessage: string | null = null;
  newComment: CreateSocialCommentRequest = { content: '' };

  editingPost = false;
  editPostTitle = '';
  editPostContent = '';

  editingCommentId: string | null = null;
  editCommentContent = '';

  get currentUserId(): string | null {
    return this.meApi.me()?.id ?? null;
  }

  isOwnPost(post: SocialPostDetails): boolean {
    return this.currentUserId !== null && this.currentUserId === post.userId;
  }

  isOwnComment(comment: SocialComment): boolean {
    return this.currentUserId !== null && this.currentUserId === comment.userId;
  }

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
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        console.error('取得貼文失敗:', err);
        this.loading = false;
        this.loadError = err.status === 404 ? '這篇貼文不存在或已被下架。' : '取得貼文失敗，請稍後再試。';
        this.cdr.detectChanges();
      }
    });
  }

  // ---- 編輯／刪除自己的貼文 ----

  startEditPost(): void {
    if (!this.post) return;
    this.editPostTitle = this.post.title;
    this.editPostContent = this.post.content;
    this.editingPost = true;
  }

  cancelEditPost(): void {
    this.editingPost = false;
  }

  // PUT /api/v1/social/posts/{id}（只有作者本人能改）
  saveEditPost(): void {
    if (!this.post) return;
    this.actionError = null;
    this.socialApi.updatePost(this.post.id, { title: this.editPostTitle, content: this.editPostContent }).subscribe({
      next: () => {
        this.editingPost = false;
        this.loadPost();
      },
      error: (err: HttpErrorResponse) => {
        this.actionError = this.describeOwnershipError(err, '更新貼文');
        console.error('更新貼文失敗:', err);
        this.cdr.detectChanges();
      }
    });
  }

  // DELETE /api/v1/social/posts/{id}（只有作者本人能刪，軟刪除）
  deletePost(): void {
    if (!this.post) return;
    if (!confirm('確定要刪除這篇貼文嗎？刪除後無法復原。')) return;
    this.socialApi.deletePost(this.post.id).subscribe({
      next: () => this.router.navigateByUrl('/social/posts'),
      error: (err: HttpErrorResponse) => {
        this.actionError = this.describeOwnershipError(err, '刪除貼文');
        console.error('刪除貼文失敗:', err);
        this.cdr.detectChanges();
      }
    });
  }

  // ---- 編輯／刪除自己的留言 ----

  startEditComment(comment: SocialComment): void {
    this.editingCommentId = comment.id;
    this.editCommentContent = comment.content;
  }

  cancelEditComment(): void {
    this.editingCommentId = null;
  }

  // PUT /api/v1/social/comments/{id}（只有留言作者本人能改）
  saveEditComment(commentId: string): void {
    this.actionError = null;
    this.socialApi.updateComment(commentId, { content: this.editCommentContent }).subscribe({
      next: () => {
        this.editingCommentId = null;
        this.loadPost();
      },
      error: (err: HttpErrorResponse) => {
        this.actionError = this.describeOwnershipError(err, '更新留言');
        console.error('更新留言失敗:', err);
        this.cdr.detectChanges();
      }
    });
  }

  // DELETE /api/v1/social/comments/{id}（只有留言作者本人能刪，軟刪除）
  deleteComment(commentId: string): void {
    if (!confirm('確定要刪除這則留言嗎？刪除後無法復原。')) return;
    this.socialApi.deleteComment(commentId).subscribe({
      next: () => this.loadPost(),
      error: (err: HttpErrorResponse) => {
        this.actionError = this.describeOwnershipError(err, '刪除留言');
        console.error('刪除留言失敗:', err);
        this.cdr.detectChanges();
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
        this.cdr.detectChanges();
      }
    });
  }

  onReported(): void {
    this.reportSuccessMessage = '已送出檢舉，管理員審核後會處理。';
    this.cdr.detectChanges();
  }

  private describeOwnershipError(err: HttpErrorResponse, action: string): string {
    if (err.status === 401) return `${action}失敗：請先登入。`;
    if (err.status === 403) return `${action}失敗：只有作者本人才能操作。`;
    return `${action}失敗，請稍後再試。`;
  }
}
