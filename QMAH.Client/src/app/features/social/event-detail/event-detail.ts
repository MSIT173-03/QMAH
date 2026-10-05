import { ChangeDetectorRef, Component, Input, OnChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { SocialApiService, SocialEventDetails } from '../../../core/services/social-api';
import { EventMapComponent } from '../../../shared/components/event-map/event-map';
import { PostDetailComponent } from '../post-detail/post-detail';
import { publishStatusLabel, reviewStatusLabel } from '../social-labels';
import { LucideArrowLeft, LucideCalendarClock, LucideMessageCircle, LucideHourglass, LucideMapPin, LucideUserRound, LucideUsers } from '@lucide/angular';

@Component({
  selector: 'app-event-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, EventMapComponent, PostDetailComponent, LucideArrowLeft, LucideCalendarClock, LucideMessageCircle, LucideHourglass, LucideMapPin, LucideUserRound, LucideUsers],
  templateUrl: './event-detail.html',
  styleUrls: ['../social-common.scss', './event-detail.scss']
})
export class EventDetailComponent implements OnChanges {
  // 路由參數 :id 由 app.config.ts 的 withComponentInputBinding() 自動綁定
  @Input() id!: string;

  private socialApi = inject(SocialApiService);
  private cdr = inject(ChangeDetectorRef);

  readonly reviewStatusLabel = reviewStatusLabel;
  readonly publishStatusLabel = publishStatusLabel;
  event: SocialEventDetails | null = null;
  loading = false;
  loadError: string | null = null;
  actionError: string | null = null;
  actionPending = false;
  // 活動貼文與留言直接展開在這一頁，使用者不會跳離報名頁面。
  showDiscussion = false;

  toggleDiscussion(): void {
    this.showDiscussion = !this.showDiscussion;
  }

  // 報名按鈕狀態：伺服器仍是最終裁判（會回 400/409），前端只是提早讓按鈕不可按並說明原因。
  // 活動時間是不帶時區的台灣當地時間，new Date() 會以瀏覽器所在時區解讀，與使用者輸入時一致。
  get registrationState(): 'OPEN' | 'FULL' | 'CLOSED' | 'ENDED' {
    const event = this.event;
    if (!event) return 'OPEN';
    const now = Date.now();
    if (new Date(event.endAt).getTime() <= now) return 'ENDED';
    if (event.registrationEndAt && new Date(event.registrationEndAt).getTime() < now) return 'CLOSED';
    if (event.capacity && event.registrationCount >= event.capacity) return 'FULL';
    return 'OPEN';
  }

  ngOnChanges(): void {
    if (this.id) this.loadEvent();
  }

  // GET /api/v1/social/events/{id}（AllowAnonymous；審核／發布狀態只有發起人看得到）
  loadEvent(): void {
    this.loading = true;
    this.loadError = null;
    this.socialApi.getEvent(this.id).subscribe({
      next: (event) => {
        this.event = event;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.loadError = err.status === 404 ? '這場活動不存在或目前不可參加。' : '取得活動失敗，請稍後再試。';
        console.error('取得活動詳情失敗:', err);
        this.cdr.detectChanges();
      }
    });
  }

  // POST /api/v1/social/events/{id}/registration（需要登入）
  register(): void {
    if (!this.event) return;
    this.actionError = null;
    this.actionPending = true;
    this.socialApi.registerEvent(this.event.id).subscribe({
      next: (event) => {
        this.event = event;
        this.actionPending = false;
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        this.actionPending = false;
        // 400/409 時 API 會回具體原因（已額滿、報名已截止、活動已結束），直接顯示給使用者。
        const detail = typeof err.error?.detail === 'string' ? err.error.detail : null;
        this.actionError = err.status === 401 ? '請先登入才能報名。' : (detail ?? '報名失敗，請稍後再試。');
        console.error('報名失敗:', err);
        this.cdr.detectChanges();
      }
    });
  }

  // DELETE /api/v1/social/events/{id}/registration（需要登入）
  cancelRegistration(): void {
    if (!this.event) return;
    this.actionError = null;
    this.actionPending = true;
    this.socialApi.cancelEventRegistration(this.event.id).subscribe({
      next: (event) => {
        this.event = event;
        this.actionPending = false;
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        this.actionPending = false;
        this.actionError = err.status === 401 ? '請先登入才能取消報名。' : '取消報名失敗，請稍後再試。';
        console.error('取消報名失敗:', err);
        this.cdr.detectChanges();
      }
    });
  }
}
