import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { MeApiService } from '../../../core/services/me-api';
import { demoEvent, isDemoAdmin } from '../social-demo';
import { UserAvatarComponent } from '../../../shared/components/user-avatar/user-avatar';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { CreateSocialEventRequest, EventListItem, SocialApiService, SocialMedia } from '../../../core/services/social-api';
import { ImageCropModalComponent } from '../../../shared/components/image-crop-modal/image-crop-modal';
import { LocationPick, LocationPickerComponent } from '../../../shared/components/location-picker/location-picker';
import { LucideArrowRight, LucideCalendarClock, LucideMapPin, LucidePlus, LucideUsers, LucideX } from '@lucide/angular';

// 與後端 EventScheduleRules.MaxCapacity 相同。
const MAX_EVENT_CAPACITY = 10000;

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ImageCropModalComponent, LocationPickerComponent, LucideArrowRight, LucideCalendarClock, LucideMapPin, LucidePlus, LucideUsers, LucideX, UserAvatarComponent],
  templateUrl: './events.html',
  styleUrls: ['../social-common.scss', './events.scss']
})
export class EventsComponent implements OnInit {
  private socialApi = inject(SocialApiService);
  private cdr = inject(ChangeDetectorRef);
  private meApi = inject(MeApiService);

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
    // 管理員示範用：表單是空的才預填，不會蓋掉已經在寫的內容。
    if (isDemoAdmin(this.meApi.me()) && !this.newEvent.title.trim() && !this.newEvent.content.trim()) {
      this.newEvent = demoEvent();
    }
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

  // 從地圖選點：座標一定會更新；反查到地址時才覆蓋地點文字（沒查到就保留使用者原本填的）。
  onLocationPicked(pick: LocationPick): void {
    this.newEvent.latitude = pick.latitude;
    this.newEvent.longitude = pick.longitude;
    if (pick.location !== null) this.newEvent.location = pick.location;
    this.cdr.detectChanges();
  }

  // 清除位置只清座標；地點文字是使用者可能自己輸入的，不一起清掉。
  onLocationCleared(): void {
    this.newEvent.latitude = null;
    this.newEvent.longitude = null;
    this.cdr.detectChanges();
  }

  // POST /api/v1/social/events（需要登入；新活動要等管理員審核通過才會公開顯示）
  // 送出按鈕是 type="button"，故意不靠 <form method="dialog"> 自動關閉視窗，
  // 避免請求還沒回來、或失敗時視窗就先關掉導致看不到錯誤訊息。
  submitEvent(): void {
    this.createError = null;
    const problems = this.validateNewEvent();
    if (problems.length > 0) {
      this.createError = problems.join(' ');
      return;
    }

    this.socialApi.createEvent(this.newEvent).subscribe({
      next: () => {
        this.newEvent = { eventType: 'PLAYER', title: '', content: '', startAt: '', endAt: '', mediaIds: [] };
        this.pendingMedia = [];
        this.loadEvents();
        this.createEventDialog?.nativeElement.close();
        alert('活動已建立，等待管理員審核通過後才會公開顯示。');
      },
      error: (err: HttpErrorResponse) => {
        this.createError = this.describeCreateError(err);
        console.error('建立活動失敗:', err);
      }
    });
  }

  // 前端先做基本檢查，讓使用者立刻看到哪裡要改；伺服器仍會用同一組規則（EventScheduleRules）再驗證一次。
  private validateNewEvent(): string[] {
    const event = this.newEvent;
    const problems: string[] = [];
    const now = new Date();
    // datetime-local 的值不帶時區，new Date() 會以瀏覽器所在時區解讀，與使用者輸入一致。
    const toDate = (value?: string | null) => (value ? new Date(value) : null);
    const start = toDate(event.startAt);
    const end = toDate(event.endAt);
    const registrationEnd = toDate(event.registrationEndAt);

    if (!event.title.trim()) problems.push('請輸入活動標題。');
    if (!event.content.trim()) problems.push('請輸入活動說明。');

    if (!start || Number.isNaN(start.getTime())) problems.push('請選擇開始時間。');
    else if (start <= now) problems.push('開始時間必須晚於現在。');

    if (!end || Number.isNaN(end.getTime())) problems.push('請選擇結束時間。');
    else if (start && !Number.isNaN(start.getTime()) && end <= start) problems.push('結束時間必須晚於開始時間。');

    if (registrationEnd && !Number.isNaN(registrationEnd.getTime())) {
      if (start && !Number.isNaN(start.getTime()) && registrationEnd > start) {
        problems.push('報名截止時間不能晚於開始時間。');
      } else if (registrationEnd <= now) {
        problems.push('報名截止時間必須晚於現在。');
      }
    }

    const capacity = event.capacity;
    if (capacity !== null && capacity !== undefined) {
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_EVENT_CAPACITY) {
        problems.push(`名額上限必須是 1 到 ${MAX_EVENT_CAPACITY} 的整數。`);
      }
    }

    return problems;
  }

  // 優先顯示 API 回傳的具體原因（欄位錯誤或 detail），不再一律顯示「請確認欄位是否正確」。
  private describeCreateError(err: HttpErrorResponse): string {
    if (err.status === 401) return '請先登入才能建立活動。';
    if (err.status === 403) return '你的帳號沒有建立這種活動的權限。';
    if (err.status === 429) return '操作太頻繁，請稍後再試。';

    const fieldErrors = err.error?.errors as Record<string, string[]> | undefined;
    if (fieldErrors) {
      const messages = Object.values(fieldErrors).flat().filter(Boolean);
      if (messages.length > 0) return messages.join(' ');
    }

    if (typeof err.error?.detail === 'string' && err.error.detail) return err.error.detail;
    return '建立活動失敗，請確認欄位是否正確。';
  }
}
