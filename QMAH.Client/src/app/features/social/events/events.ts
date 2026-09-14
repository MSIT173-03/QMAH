import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { CreateSocialEventRequest, EventListItem, SocialApiService } from '../../../core/services/social-api';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './events.html',
  styleUrl: './events.scss'
})
export class EventsComponent implements OnInit {
  private socialApi = inject(SocialApiService);

  events: EventListItem[] = [];
  loadError: string | null = null;
  createError: string | null = null;

  newEvent: CreateSocialEventRequest = {
    eventType: 'PLAYER',
    title: '',
    content: '',
    startAt: '',
    endAt: ''
  };

  ngOnInit(): void {
    this.loadEvents();
  }

  // GET /api/v1/social/events（AllowAnonymous，只回傳審核通過且已發布的活動）
  loadEvents(): void {
    this.loadError = null;
    this.socialApi.getEvents({ pageSize: 20 }).subscribe({
      next: (page) => (this.events = page.items),
      error: (err) => {
        this.loadError = '取得活動列表失敗，請稍後再試。';
        console.error('取得活動列表失敗:', err);
      }
    });
  }

  // POST /api/v1/social/events（需要登入；新活動要等管理員審核通過才會公開顯示）
  // 送出按鈕是 type="button"，故意不靠 <form method="dialog"> 自動關閉視窗，
  // 避免請求還沒回來、或失敗時視窗就先關掉導致看不到錯誤訊息。
  submitEvent(): void {
    this.createError = null;
    this.socialApi.createEvent(this.newEvent).subscribe({
      next: () => {
        this.newEvent = { eventType: 'PLAYER', title: '', content: '', startAt: '', endAt: '' };
        this.loadEvents();
        (document.getElementById('create_event_modal') as HTMLDialogElement | null)?.close();
        alert('活動已建立，等待管理員審核通過後才會公開顯示。');
      },
      error: (err: HttpErrorResponse) => {
        this.createError = err.status === 401 ? '請先登入才能建立活動。' : '建立活動失敗，請確認欄位是否正確。';
        console.error('建立活動失敗:', err);
      }
    });
  }
}
