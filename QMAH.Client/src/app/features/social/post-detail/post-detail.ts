import { ChangeDetectorRef, Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { UserAvatarComponent } from '../../../shared/components/user-avatar/user-avatar';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { CreateSocialCommentRequest, SocialApiService, SocialComment, SocialMedia, SocialPostArtifact, SocialPostDetails } from '../../../core/services/social-api';
import { MeApiService } from '../../../core/services/me-api';
import { ReportModalComponent } from '../../../shared/components/report-modal/report-modal';
import { SocialEditorComponent } from '../../../shared/components/social-editor/social-editor';
import { SocialMediaLayout, SocialMediaManagerComponent } from '../../../shared/components/social-media-manager/social-media-manager';
import { SocialPostContentComponent } from '../../../shared/components/social-post-content/social-post-content';
import { SocialEventContentComponent } from '../../../shared/components/social-event-content/social-event-content';
import { demoComment, isDemoAdmin } from '../social-demo';
import { boardLabel } from '../social-labels';
import { LucideArrowLeft, LucideEllipsis, LucideFlag, LucideMessageCircle, LucidePencil, LucideTrash2 } from '@lucide/angular';

@Component({
  selector: 'app-post-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ReportModalComponent, SocialPostContentComponent, SocialEventContentComponent, SocialEditorComponent, SocialMediaManagerComponent, LucideArrowLeft, LucideEllipsis, LucideFlag, LucideMessageCircle, LucidePencil, LucideTrash2, UserAvatarComponent],
  templateUrl: './post-detail.html',
  styleUrls: ['../social-common.scss', './post-detail.scss']
})
export class PostDetailComponent implements OnChanges {
  // 路由參數 :id 由 app.config.ts 的 withComponentInputBinding() 自動綁定
  @Input() id!: string;
  // 嵌入其他頁面（例如活動詳情）時為 true：不顯示「返回貼文列表」，也不撐出獨立頁面的外距，使用者不必離開原頁面。
  @Input() embedded = false;

  private socialApi = inject(SocialApiService);
  private meApi = inject(MeApiService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  readonly boardLabel = boardLabel;
  post: SocialPostDetails | null = null;
  loading = false;
  loadError: string | null = null;
  actionError: string | null = null;
  reportSuccessMessage: string | null = null;
  newComment: CreateSocialCommentRequest = { content: '' };
  /** 文物專屬討論串的文物卡（沒有文物的貼文維持 null） */
  artifact: SocialPostArtifact | null = null;

  editingPost = false;
  editPostTitle = '';
  editPostContent = '';
  editMedia: SocialMedia[] = [];
  editLayout: SocialMediaLayout = 'SECONDARY';

  editingCommentId: string | null = null;
  editCommentContent = '';

  get currentUserId(): string | null {
    return this.meApi.me()?.id ?? null;
  }

  /** 沒有插入內文的圖片才收在貼文旁（插入內文的由內文自己顯示） */
  attachedMedia(post: SocialPostDetails): SocialMedia[] {
    const text = post.content.toLowerCase();
    return post.media.filter((item) => !text.includes(`[img=${item.id.toLowerCase()}]`));
  }

  isOwnPost(post: SocialPostDetails): boolean {
    return this.currentUserId !== null && this.currentUserId === post.userId;
  }

  isOwnComment(comment: SocialComment): boolean {
    return this.currentUserId !== null && this.currentUserId === comment.userId;
  }

  ngOnChanges(changes: SimpleChanges): void {
    // 只在 id 變動時重新載入；embedded 之類的其他輸入變動不需要重打 API。
    if (changes['id'] && this.id) this.loadPost();
  }

  // GET /api/v1/social/posts/{id}（AllowAnonymous）
  loadPost(): void {
    this.loading = true;
    this.loadError = null;
    this.socialApi.getPost(this.id).subscribe({
      next: (post) => {
        this.post = post;
        this.loadArtifact(post);
        this.prefillDemoComment();
        this.loading = false;
        this.cdr.detectChanges();
        this.scrollToCommentsIfRequested();
      },
      error: (err: HttpErrorResponse) => {
        console.error('取得貼文失敗:', err);
        this.loading = false;
        this.loadError = err.status === 404 ? '這篇貼文不存在或已被下架。' : '取得貼文失敗，請稍後再試。';
        this.cdr.detectChanges();
      }
    });
  }

  private loadArtifact(post: SocialPostDetails): void {
    this.artifact = null;
    if (!post.artifactId) return;
    this.socialApi.getPostArtifact(post.id).subscribe({
      next: (artifact) => { this.artifact = artifact; this.cdr.detectChanges(); },
      error: () => { this.artifact = null; },
    });
  }

  /** 從貼文牆點「N 則留言」進來（網址帶 #comments）時，直接捲到留言區。 */
  private scrollToCommentsIfRequested(): void {
    if (this.embedded || !this.router.url.includes('#comments')) return;
    setTimeout(() => document.getElementById('post-comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }

  /** 已經含有格式標記的留言編輯時直接開啟進階模式，否則維持純文字。 */
  hasMarkup(text: string): boolean {
    return /\[\/?[a-z*]+(=[^\]\s]+)?\]/i.test(text);
  }

  // ---- 編輯／刪除自己的貼文 ----

  // 管理員示範用：留言框是空的就先放一則示範留言，報告時只要按「送出留言」。
  private prefillDemoComment(): void {
    if (isDemoAdmin(this.meApi.me()) && !this.newComment.content.trim()) {
      this.newComment = { content: demoComment() };
    }
  }

  // daisyUI dropdown 靠焦點開合；選了項目後主動失焦，選單才會收起來。
  closeMenu(): void {
    (document.activeElement as HTMLElement | null)?.blur();
  }

  startEditPost(): void {
    if (!this.post) return;
    this.editPostTitle = this.post.title;
    this.editPostContent = this.post.content;
    this.editMedia = [...this.post.media];
    this.editLayout = this.post.mediaLayout ?? 'SECONDARY';
    this.editingPost = true;
  }

  cancelEditPost(): void {
    this.editingPost = false;
  }

  // PUT /api/v1/social/posts/{id}（只有作者本人能改）
  saveEditPost(): void {
    if (!this.post) return;
    this.actionError = null;
    this.socialApi.updatePost(this.post.id, {
      title: this.editPostTitle,
      content: this.editPostContent,
      mediaLayout: this.editLayout,
      mediaIds: this.editMedia.map((item) => item.id)
    }).subscribe({
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
        this.prefillDemoComment();
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
