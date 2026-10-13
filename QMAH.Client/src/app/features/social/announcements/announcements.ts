import { RouterLink } from '@angular/router';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SocialPostContentComponent } from '../../../shared/components/social-post-content/social-post-content';

import { Announcement, SocialApiService } from '../../../core/services/social-api';
import { LucideChevronDown, LucideChevronRight, LucidePin } from '@lucide/angular';
import { boardLabel } from '../social-labels';
import { stripSocialMarkup } from '../../../shared/social-markup';
import { SocialSpotlightComponent } from '../../../shared/components/social-spotlight/social-spotlight';
import { SocialShellComponent } from '../../../shared/components/social-shell/social-shell';
import { SocialToolbarComponent } from '../../../shared/components/social-toolbar/social-toolbar';

@Component({
  selector: 'app-announcements',
  standalone: true,
  imports: [RouterLink, LucideChevronRight, SocialSpotlightComponent, LucideChevronDown, LucidePin, SocialShellComponent, SocialToolbarComponent, CommonModule, SocialPostContentComponent],
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

  /** 公告分類：全部／社群／商城（商城公告只在商城輪播，這裡是同時看到所有類型的地方） */
  scope: 'ALL' | 'COMMUNITY' | 'STORE' = 'ALL';
  readonly scopes = [{ key: 'ALL', label: '全部' }, { key: 'COMMUNITY', label: '社群公告' }, { key: 'STORE', label: '商城公告' }] as const;

  filterKeyword = '';
  filterFrom = '';
  filterTo = '';

  /** 目前條件下的公告；公告量不大，關鍵字與日期直接在載入的清單上篩，不再多打一次查詢。 */
  get filtered(): Announcement[] {
    const keyword = this.filterKeyword.trim().toLowerCase();
    const from = this.filterFrom ? new Date(this.filterFrom + 'T00:00:00').getTime() : null;
    const to = this.filterTo ? new Date(this.filterTo + 'T00:00:00').getTime() + 86_400_000 : null;
    return this.announcements.filter(item => {
      if (this.scope === 'STORE' ? item.category !== 'STORE' : this.scope === 'COMMUNITY' && item.category === 'STORE') return false;
      const at = Date.parse(item.createdAt);
      if (from !== null && at < from) return false;
      if (to !== null && at >= to) return false;
      return !keyword || (item.title + ' ' + stripSocialMarkup(item.content || item.summary)).toLowerCase().includes(keyword);
    });
  }

  get latest(): Announcement | null {
    return this.filtered[0] ?? null;
  }

  get earlier(): Announcement[] {
    return this.filtered.slice(1);
  }

  get hasFilter(): boolean {
    return !!(this.filterKeyword.trim() || this.filterFrom || this.filterTo || this.scope !== 'ALL');
  }

  resetFilters(): void {
    this.filterKeyword = '';
    this.filterFrom = '';
    this.filterTo = '';
    this.scope = 'ALL';
    this.cdr.markForCheck();
  }

  readonly excerpt = (item: Announcement): string => {
    const text = stripSocialMarkup(item.summary || item.content);
    return text.length > 90 ? text.slice(0, 90) + '…' : text;
  };

  weekday(iso: string): string {
    return new Date(iso).toLocaleDateString('zh-TW', { weekday: 'short' });
  }

  toggle(id: string): void {
    if (!this.expanded.delete(id)) this.expanded.add(id);
  }

  ngOnInit(): void {
    this.loadAnnouncements();
  }

  // GET /api/v1/social/announcements（AllowAnonymous）
  loadAnnouncements(): void {
    this.loadError = null;
    this.socialApi.getAnnouncements({ pageSize: 50 }).subscribe({
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
