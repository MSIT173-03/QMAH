import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { CreateSocialPostRequest, SocialApiService, SocialMedia, SocialPostListItem } from '../../../core/services/social-api';
import { MeApiService } from '../../../core/services/me-api';
import { ImageCropModalComponent } from '../../../shared/components/image-crop-modal/image-crop-modal';
import { ReportModalComponent } from '../../../shared/components/report-modal/report-modal';
import { SocialPostContentComponent } from '../../../shared/components/social-post-content/social-post-content';
import { QmahIconComponent } from '../../../shared/components/qmah-icon/qmah-icon';
import {
  LucideChevronLeft,
  LucideChevronRight,
  LucideFlag,
  LucideImage,
  LucideMessageCircle,
  LucideMegaphone,
  LucidePlus,
  LucideUserRound,
  LucideX,
} from '@lucide/angular';

@Component({
  selector: 'app-posts',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ImageCropModalComponent,
    ReportModalComponent,
    SocialPostContentComponent,
    QmahIconComponent,
    LucideChevronLeft,
    LucideChevronRight,
    LucideFlag,
    LucideImage,
    LucideMessageCircle,
    LucideMegaphone,
    LucidePlus,
    LucideUserRound,
    LucideX,
  ],
  templateUrl: './posts.html',
  styleUrl: './posts.scss'
})
export class PostsComponent implements OnInit, OnDestroy {
  private socialApi = inject(SocialApiService);
  private meApi = inject(MeApiService);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild(ImageCropModalComponent) private cropModal!: ImageCropModalComponent;
  @ViewChild('createPostDialog') private createPostDialog?: ElementRef<HTMLDialogElement>;
  private cropQueue: File[] = [];

  posts: SocialPostListItem[] = [];
  totalCount = 0;
  loading = false;
  loadError: string | null = null;
  createError: string | null = null;
  reportSuccessMessage: string | null = null;
  newPost: CreateSocialPostRequest = { postType: 'POST', boardCode: 'GENERAL', title: '', content: '', mediaIds: [] };

  pendingMedia: SocialMedia[] = [];
  uploadPending = false;

  boardCodes: string[] = [];
  filterBoardCode = '';
  filterKeyword = '';

  // 貼文牆頂端的公告輪播：只取最新 5 則公告貼文，每 5 秒自動切到下一則。
  announcements: SocialPostListItem[] = [];
  currentAnnouncementIndex = 0;
  /** ui-integration: 公告是 supporting context，收合偏好留在瀏覽器，避免每次進入貼文牆都推開主內容。 */
  announcementCollapsed = signal(false);
  private readonly announcementStorageKey = 'qmah.social.announcements.collapsed';
  private announcementTimer?: ReturnType<typeof setInterval>;

  get isAdmin(): boolean {
    return this.meApi.me()?.roles.includes('Admin') ?? false;
  }

  ngOnInit(): void {
    this.announcementCollapsed.set(this.readAnnouncementCollapsePreference());
    this.loadPosts();
    this.loadAnnouncements();
    this.socialApi.getBoards().subscribe({
      next: (boards) => {
        this.boardCodes = boards;
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => console.error('取得看板清單失敗:', err)
    });
  }

  ngOnDestroy(): void {
    if (this.announcementTimer) clearInterval(this.announcementTimer);
  }

  private loadAnnouncements(): void {
    this.socialApi.getPosts({ postType: 'ANNOUNCEMENT', pageSize: 5 }).subscribe({
      next: (page) => {
        this.announcements = page.items;
        this.currentAnnouncementIndex = 0;
        this.syncAnnouncementTimer();
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => console.error('取得最新公告失敗:', err)
    });
  }

  private readAnnouncementCollapsePreference(): boolean {
    try {
      return localStorage.getItem(this.announcementStorageKey) === '1';
    } catch {
      return false;
    }
  }

  private syncAnnouncementTimer(): void {
    if (this.announcementTimer) clearInterval(this.announcementTimer);
    this.announcementTimer = undefined;
    if (!this.announcementCollapsed() && this.announcements.length > 1) {
      this.announcementTimer = setInterval(() => this.nextAnnouncement(), 4500);
    }
  }

  toggleAnnouncements(): void {
    this.announcementCollapsed.update((collapsed) => !collapsed);
    try {
      localStorage.setItem(this.announcementStorageKey, this.announcementCollapsed() ? '1' : '0');
    } catch {
      // 瀏覽器拒絕儲存時仍保留本次頁面操作，不讓偏好設定影響公告瀏覽。
    }
    this.syncAnnouncementTimer();
  }

  nextAnnouncement(): void {
    if (this.announcements.length === 0) return;
    this.currentAnnouncementIndex = (this.currentAnnouncementIndex + 1) % this.announcements.length;
    this.cdr.detectChanges();
  }

  previousAnnouncement(): void {
    if (this.announcements.length === 0) return;
    this.currentAnnouncementIndex =
      (this.currentAnnouncementIndex - 1 + this.announcements.length) % this.announcements.length;
    this.cdr.detectChanges();
  }

  goToAnnouncement(index: number): void {
    this.currentAnnouncementIndex = index;
    this.cdr.detectChanges();
  }

  openCreatePost(): void {
    // ui-integration: 由 Angular 保留對話框的 focus／Escape 行為，避免依賴全域 id 變數開啟發布流程。
    this.createPostDialog?.nativeElement.showModal();
  }

  resetFilters(): void {
    this.filterBoardCode = '';
    this.filterKeyword = '';
    this.loadPosts();
  }

  // 編輯器只插入純文字標記；共用呈現元件會把小標、項目與引用轉成安全的視覺層次。
  formatPostContent(kind: 'heading' | 'bullet' | 'quote' | 'paragraph'): void {
    const textarea = document.querySelector('#social-post-content') as HTMLTextAreaElement | null;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end) || '請填寫內容';
    const [prefix, suffix] = kind === 'heading'
      ? ['【', '】']
      : kind === 'bullet'
        ? ['• ', '']
        : kind === 'quote'
          ? ['「', '」']
          : ['\n', ''];
    const formatted = kind === 'paragraph'
      ? `${textarea.value.slice(0, start)}\n${textarea.value.slice(end)}`
      : `${textarea.value.slice(0, start)}${selected.split('\n').map(line => prefix + line + suffix).join('\n')}${textarea.value.slice(end)}`;
    this.newPost.content = formatted;
    textarea.focus();
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
        this.createPostDialog?.nativeElement.close();
      },
      error: (err: HttpErrorResponse) => {
        this.createError = err.status === 401 ? '發布失敗：請先登入。' : '發布貼文失敗，請確認欄位是否正確。';
        console.error('發布貼文失敗:', err);
      }
    });
  }

  onReported(): void {
    this.reportSuccessMessage = '已送出檢舉，管理員審核後會處理。';
    this.cdr.detectChanges();
  }

}
