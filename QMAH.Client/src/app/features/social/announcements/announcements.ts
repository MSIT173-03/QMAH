import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SocialPostContentComponent } from '../../../shared/components/social-post-content/social-post-content';

import { Announcement, SocialApiService } from '../../../core/services/social-api';
import { LucideChevronDown } from '@lucide/angular';
import { boardLabel } from '../social-labels';
import { SocialSpotlightComponent } from '../../../shared/components/social-spotlight/social-spotlight';
import { SocialShellComponent } from '../../../shared/components/social-shell/social-shell';

@Component({
  selector: 'app-announcements',
  standalone: true,
  imports: [SocialSpotlightComponent, LucideChevronDown, SocialShellComponent, CommonModule, SocialPostContentComponent],
  templateUrl: './announcements.html',
  styleUrls: ['../social-common.scss', './announcements.scss']
})
export class AnnouncementsComponent implements OnInit {
  private socialApi = inject(SocialApiService);
  private cdr = inject(ChangeDetectorRef);

  announcements: Announcement[] = [];
  readonly label = boardLabel;
  loadError: string | null = null;
  /** 已展開全文的公告 */
  readonly expanded = new Set<string>();

  toggle(id: string): void {
    if (!this.expanded.delete(id)) this.expanded.add(id);
  }

  /** 內容較長時才顯示「展開全文」 */
  isLong(text: string): boolean {
    return text.length > 140 || text.split('\n').length > 4;
  }

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
