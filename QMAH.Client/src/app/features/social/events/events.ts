import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { CreateSocialEventRequest, EventListItem, SocialApiService, SocialMedia } from '../../../core/services/social-api';
import { ImageCropModalComponent } from '../../../shared/components/image-crop-modal/image-crop-modal';
import { LucideCalendarClock, LucideMapPin, LucidePlus, LucideUserRound, LucideX } from '@lucide/angular';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ImageCropModalComponent, LucideCalendarClock, LucideMapPin, LucidePlus, LucideUserRound, LucideX],
  templateUrl: './events.html',
  styleUrl: './events.scss'
})
export class EventsComponent implements OnInit {
  private socialApi = inject(SocialApiService);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild(ImageCropModalComponent) private cropModal!: ImageCropModalComponent;
  @ViewChild('createEventDialog') private createEventDialog?: ElementRef<HTMLDialogElement>;
  private cropQueue: File[] = [];

  events: EventListItem[] = [];
  loadError: string | null = null;
  createError: string | null = null;

  newEvent: CreateSocialEventRequest = {
    eventType: 'PLAYER',
    title: '',
    content: '',
    startAt: '',
    endAt: '',
    mediaIds: []
  };

  pendingMedia: SocialMedia[] = [];
  uploadPending = false;

  filterKeyword = '';
  filterStartAfter = '';
  filterStartBefore = '';

  ngOnInit(): void {
    this.loadEvents();
  }

  resetFilters(): void {
    this.filterKeyword = '';
    this.filterStartAfter = '';
    this.filterStartBefore = '';
    this.loadEvents();
  }

  // ui-integration: 由 Angular 管理活動對話框的開啟，保留原本建立流程並避免 inline onclick 依賴全域 DOM 變數。
  openCreateEvent(): void {
    this.createEventDialog?.nativeElement.showModal();
  }

  // GET /api/v1/social/events（AllowAnonymous，只回傳審核通過且已發布的活動）
  loadEvents(): void {
    this.loadError = null;
    this.socialApi.getEvents({
      pageSize: 20,
      q: this.filterKeyword || undefined,
      startAfter: this.filterStartAfter || undefined,
      startBefore: this.filterStartBefore || undefined
    }).subscribe({
      next: (page) => {
        this.events = page.items;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loadError = '取得活動列表失敗，請稍後再試。';
        console.error('取得活動列表失敗:', err);
        this.cdr.detectChanges();
      }
    });
  }

  // 選好的圖片先逐張進裁切彈窗，裁切完（或略過裁切）才呼叫 POST /api/v1/social/media 上傳，
  // 最多附 8 張，上傳成功才把 id 放進 newEvent.mediaIds。
  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 8 - (this.newEvent.mediaIds?.length ?? 0);
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
        this.newEvent.mediaIds = [...(this.newEvent.mediaIds ?? []), media.id];
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
        this.dropPendingMedia(media.id);
      }
    });
  }

  private dropPendingMedia(mediaId: string): void {
    this.pendingMedia = this.pendingMedia.filter((item) => item.id !== mediaId);
    this.newEvent.mediaIds = (this.newEvent.mediaIds ?? []).filter((id) => id !== mediaId);
  }

  // POST /api/v1/social/events（需要登入；新活動要等管理員審核通過才會公開顯示）
  // 送出按鈕是 type="button"，故意不靠 <form method="dialog"> 自動關閉視窗，
  // 避免請求還沒回來、或失敗時視窗就先關掉導致看不到錯誤訊息。
  submitEvent(): void {
    this.createError = null;
    this.socialApi.createEvent(this.newEvent).subscribe({
      next: () => {
        this.newEvent = { eventType: 'PLAYER', title: '', content: '', startAt: '', endAt: '', mediaIds: [] };
        this.pendingMedia = [];
        this.loadEvents();
        this.createEventDialog?.nativeElement.close();
        alert('活動已建立，等待管理員審核通過後才會公開顯示。');
      },
      error: (err: HttpErrorResponse) => {
        this.createError = err.status === 401 ? '請先登入才能建立活動。' : '建立活動失敗，請確認欄位是否正確。';
        console.error('建立活動失敗:', err);
      }
    });
  }
}
