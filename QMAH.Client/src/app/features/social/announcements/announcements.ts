import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Announcement, SocialApiService } from '../../../core/services/social-api';

@Component({
  selector: 'app-announcements',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './announcements.html',
  styleUrl: './announcements.scss'
})
export class AnnouncementsComponent implements OnInit {
  private socialApi = inject(SocialApiService);
  private cdr = inject(ChangeDetectorRef);

  announcements: Announcement[] = [];
  loadError: string | null = null;

  ngOnInit(): void {
    this.loadAnnouncements();
  }

  // GET /api/v1/social/announcements（AllowAnonymous）
  loadAnnouncements(): void {
    this.loadError = null;
    this.socialApi.getAnnouncements({ pageSize: 20 }).subscribe({
      next: (page) => {
        this.announcements = page.items;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loadError = '取得公告失敗，請稍後再試。';
        console.error('取得公告失敗:', err);
        this.cdr.detectChanges();
      }
    });
  }
}
