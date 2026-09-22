import { ChangeDetectorRef, Component, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';

import { SocialApiService, SocialEventDetails } from '../../../core/services/social-api';
import { QmahIconComponent } from '../qmah-icon/qmah-icon';

// 活動管理列表點「活動名稱」用的小視窗：GetEvent 已經對 Admin 開放待審核／未發布的活動，
// 這裡直接彈窗看完整內容（含圖片），不用跳新分頁，看完關掉即可再回去審核。
@Component({
  selector: 'app-event-preview-modal',
  standalone: true,
  imports: [CommonModule, QmahIconComponent],
  templateUrl: './event-preview-modal.html'
})
export class EventPreviewModalComponent {
  private socialApi = inject(SocialApiService);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('dialogEl') private dialogEl!: ElementRef<HTMLDialogElement>;

  event: SocialEventDetails | null = null;
  loading = false;
  loadError: string | null = null;

  open(eventId: string): void {
    this.event = null;
    this.loadError = null;
    this.loading = true;
    this.dialogEl.nativeElement.showModal();
    this.socialApi.getEvent(eventId).subscribe({
      next: (event) => {
        this.event = event;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.loadError = err.status === 404 ? '這場活動不存在或已被刪除。' : '取得活動失敗，請稍後再試。';
        console.error('取得活動預覽失敗:', err);
        this.cdr.detectChanges();
      }
    });
  }

  close(): void {
    this.dialogEl.nativeElement.close();
  }
}
