import { ChangeDetectorRef, Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { CreateSocialPostRequest, SocialApiService, SocialMedia, SocialPostListItem } from '../../../core/services/social-api';
import { MeApiService } from '../../../core/services/me-api';
import { ImageCropModalComponent } from '../../../shared/components/image-crop-modal/image-crop-modal';

@Component({
  selector: 'app-posts',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ImageCropModalComponent],
  templateUrl: './posts.html',
  styleUrl: './posts.scss'
})
export class PostsComponent implements OnInit {
  private socialApi = inject(SocialApiService);
  private meApi = inject(MeApiService);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild(ImageCropModalComponent) private cropModal!: ImageCropModalComponent;
  private cropQueue: File[] = [];

  posts: SocialPostListItem[] = [];
  totalCount = 0;
  loading = false;
  loadError: string | null = null;
  createError: string | null = null;
  newPost: CreateSocialPostRequest = { postType: 'POST', boardCode: 'GENERAL', title: '', content: '', mediaIds: [] };

  pendingMedia: SocialMedia[] = [];
  uploadPending = false;

  boardCodes: string[] = [];
  filterBoardCode = '';
  filterKeyword = '';

  get isAdmin(): boolean {
    return this.meApi.me()?.roles.includes('Admin') ?? false;
  }

  ngOnInit(): void {
    this.loadPosts();
    this.socialApi.getBoards().subscribe({
      next: (boards) => {
        this.boardCodes = boards;
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => console.error('取得看板清單失敗:', err)
    });
  }

  resetFilters(): void {
    this.filterBoardCode = '';
    this.filterKeyword = '';
    this.loadPosts();
  }

  // GET /api/v1/social/posts（AllowAnonymous，回傳 ApiPage<SocialPostListItemDto>）
  loadPosts(): void {
    this.loading = true;
    this.loadError = null;
    this.socialApi.getPosts({
      pageSize: 20,
      boardCode: this.filterBoardCode || undefined,
      q: this.filterKeyword || undefined
    }).subscribe({
      next: (page) => {
        this.posts = page.items;
        this.totalCount = page.totalCount;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        console.error('取得貼文失敗:', err);
        this.loadError = '取得貼文失敗，請稍後再試。';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // 選好的圖片先逐張進裁切彈窗，裁切完（或略過裁切）才呼叫 POST /api/v1/social/media 上傳，
  // 最多附 8 張，上傳成功才把 id 放進 newPost.mediaIds。
  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 8 - (this.newPost.mediaIds?.length ?? 0);
    this.cropQueue.push(...Array.from(files).slice(0, Math.max(0, remainingSlots)));
    input.value = '';
    this.processNextInCropQueue();
  }

  private processNextInCropQueue(): void {
    const next = this.cropQueue.shift();
    if (next) this.cropModal.open(next);
  }

  onImageCropped(file: File): void {
    this.uploadPending = true;
    this.createError = null;
    this.socialApi.uploadMedia(file).subscribe({
      next: (media) => {
        this.pendingMedia.push(media);
        this.newPost.mediaIds = [...(this.newPost.mediaIds ?? []), media.id];
        this.uploadPending = this.cropQueue.length > 0;
        this.cdr.detectChanges();
        this.processNextInCropQueue();
      },
      error: (err: HttpErrorResponse) => {
        this.uploadPending = this.cropQueue.length > 0;
        this.createError = err.status === 401
          ? '上傳圖片失敗：請先登入。'
          : err.status === 413
            ? '上傳圖片失敗：單一圖片不可超過 8 MB。'
            : '上傳圖片失敗，請確認檔案格式是否為 JPEG／PNG／GIF／WebP。';
        console.error('上傳圖片失敗:', err);
        this.cdr.detectChanges();
        this.processNextInCropQueue();
      }
    });
  }

  onCropCancelled(): void {
    this.processNextInCropQueue();
  }

  removePendingMedia(media: SocialMedia): void {
    this.socialApi.deleteMedia(media.id).subscribe({
      next: () => this.dropPendingMedia(media.id),
      error: (err: HttpErrorResponse) => {
        console.error('移除圖片失敗:', err);
        // 就算刪除 API 失敗（例如已經被刪過），也把它從草稿裡拿掉，不要卡住使用者。
        this.dropPendingMedia(media.id);
      }
    });
  }

  private dropPendingMedia(mediaId: string): void {
    this.pendingMedia = this.pendingMedia.filter((item) => item.id !== mediaId);
    this.newPost.mediaIds = (this.newPost.mediaIds ?? []).filter((id) => id !== mediaId);
  }

  // POST /api/v1/social/posts（需要登入 + XSRF token）
  // 送出按鈕是 type="button"，故意不靠 <form method="dialog"> 自動關閉視窗，
  // 避免請求還沒回來、或失敗時視窗就先關掉導致看不到錯誤訊息。
  submitPost(): void {
    this.createError = null;
    this.socialApi.createPost(this.newPost).subscribe({
      next: () => {
        this.newPost = { postType: 'POST', boardCode: 'GENERAL', title: '', content: '', mediaIds: [] };
        this.pendingMedia = [];
        this.loadPosts();
        (document.getElementById('create_post_modal') as HTMLDialogElement | null)?.close();
      },
      error: (err: HttpErrorResponse) => {
        this.createError = err.status === 401 ? '發布失敗：請先登入。' : '發布貼文失敗，請確認欄位是否正確。';
        console.error('發布貼文失敗:', err);
      }
    });
  }

  report(id: string): void {
    this.createError = null;
    this.socialApi.createReport({ targetType: 'POST', targetId: id, reason: '使用者檢舉' }).subscribe({
      next: () => alert(`已成功檢舉貼文 #${id}`),
      error: (err: HttpErrorResponse) => {
        this.createError = err.status === 401 ? '檢舉失敗：請先登入。' : '檢舉失敗，請稍後再試。';
        console.error('檢舉失敗:', err);
      }
    });
  }
}
