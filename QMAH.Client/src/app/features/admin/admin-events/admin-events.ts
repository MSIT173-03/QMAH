import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AdminEventListItem, SocialApiService } from '../../../core/services/social-api';

@Component({
  selector: 'app-admin-events',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-events.html',
  styleUrl: './admin-events.scss'
})
export class AdminEventsComponent implements OnInit {
  private socialApi = inject(SocialApiService);

  pendingEvents: AdminEventListItem[] = [];

  ngOnInit(): void {
    this.loadPendingEvents();
  }

  // GET /api/v1/admin/events?reviewStatus=PENDING（需要 Admin 角色）
  loadPendingEvents(): void {
    this.socialApi.getAdminEvents({ reviewStatus: 'PENDING', pageSize: 50 }).subscribe({
      next: (page) => (this.pendingEvents = page.items),
      error: (err) => console.error('取得待審核活動失敗（請確認已用管理員登入）:', err)
    });
  }

  // PUT /api/v1/admin/events/:id/review
  review(id: string, status: 'APPROVED' | 'REJECTED'): void {
    this.socialApi.reviewEvent(id, { reviewStatus: status }).subscribe({
      next: () => {
        alert(`活動 ${id} 已成功審核為：${status}`);
        this.loadPendingEvents();
      },
      error: (err) => console.error('審核失敗:', err)
    });
  }
}
