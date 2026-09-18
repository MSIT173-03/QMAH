import { ChangeDetectorRef, Component, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';

import { SocialApiService, SocialPostDetails } from '../../../core/services/social-api';

// 後台檢舉/審核列表點「被檢舉內容」用的小視窗：直接彈窗看原貼文（含留言、圖片），看完關掉即可，
// 不用像 target="_blank" 那樣跳去新分頁、看完還要自己切回來。
// GetPost 對 Admin 開放了 HIDDEN/DELETED 貼文，所以檢舉已經處理過的內容一樣看得到。
@Component({
  selector: 'app-post-preview-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './post-preview-modal.html'
})
export class PostPreviewModalComponent {
  private socialApi = inject(SocialApiService);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('dialogEl') private dialogEl!: ElementRef<HTMLDialogElement>;

  post: SocialPostDetails | null = null;
  loading = false;
  loadError: string | null = null;

  open(postId: string): void {
    this.post = null;
    this.loadError = null;
    this.loading = true;
    this.dialogEl.nativeElement.showModal();
    this.socialApi.getPost(postId).subscribe({
      next: (post) => {
        this.post = post;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.loadError = err.status === 404 ? '這篇貼文不存在或已被刪除。' : '取得貼文失敗，請稍後再試。';
        console.error('取得貼文預覽失敗:', err);
        this.cdr.detectChanges();
      }
    });
  }

  close(): void {
    this.dialogEl.nativeElement.close();
  }
}
