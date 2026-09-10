import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

export interface EventItem {
  id: string;
  title: string;
  organizer: string;
  startAt: string;
  status: string;
}

@Component({
  selector: 'app-admin-events',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-events.html',
  styleUrl: './admin-events.scss'
})
export class AdminEventsComponent implements OnInit {
  private http = inject(HttpClient);

  // 清空 Mock 資料，由 DB 填入
  pendingEvents: EventItem[] = [];

  ngOnInit(): void {
    this.loadPendingEvents();
  }

  // 1. 發送 GET 取待審核活動
  loadPendingEvents(): void {
    this.http.get<EventItem[]>('/api/v1/admin/events/pending').subscribe({
      next: (data) => {
        this.pendingEvents = data;
        console.log('成功從 DB 取得待審核活動:', data);
      },
      error: (err) => console.error('取得活動失敗:', err)
    });
  }

  // 2. 發送 PUT 審核活動
  review(id: string, status: 'APPROVED' | 'REJECTED'): void {
    this.http.put(`/api/v1/admin/events/${id}/review`, { reviewStatus: status }).subscribe({
      next: () => {
        alert(`活動 ${id} 已成功審核為：${status}`);
        this.loadPendingEvents(); // 重新整理列表
      },
      error: (err) => console.error('審核失敗:', err)
    });
  }
}
