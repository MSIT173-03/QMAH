import { ChangeDetectorRef, Component, Input, OnChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { SocialApiService, SocialEventDetails } from '../../../core/services/social-api';
import { LucideArrowLeft, LucideCalendarClock, LucideMessageCircle, LucideMapPin, LucideUserRound } from '@lucide/angular';

@Component({
  selector: 'app-event-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideArrowLeft, LucideCalendarClock, LucideMessageCircle, LucideMapPin, LucideUserRound],
  templateUrl: './event-detail.html',
  styleUrl: './event-detail.scss'
})
export class EventDetailComponent implements OnChanges {
  // 路由參數 :id 由 app.config.ts 的 withComponentInputBinding() 自動綁定
  @Input() id!: string;

  private socialApi = inject(SocialApiService);
  private cdr = inject(ChangeDetectorRef);

  event: SocialEventDetails | null = null;
  loading = false;
  loadError: string | null = null;
  actionError: string | null = null;
  actionPending = false;

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
        this.actionError = err.status === 401 ? '請先登入才能報名。' : '報名失敗，請稍後再試。';
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
