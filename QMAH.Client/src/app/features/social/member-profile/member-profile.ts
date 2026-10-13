import { SocialWidthToggleComponent } from '../../../shared/components/social-width-toggle/social-width-toggle';
import { ChangeDetectorRef, Component, Input, OnChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';

import { EventListItem, SocialApiService, SocialMemberProfile, SocialPostListItem } from '../../../core/services/social-api';
import { MeApiService } from '../../../core/services/me-api';
import { BoardIconComponent } from '../../../shared/components/board-icon/board-icon';
import { LucideArrowLeft, LucideCalendarDays, LucideFileText, LucideMessageCircle, LucideSend, LucideTrophy, LucideUserRound } from '@lucide/angular';
import { boardLabel, eventMode } from '../social-labels';
import { stripSocialMarkup } from '../../../shared/social-markup';

const MESSAGE_MAX = 300;

// 公開個人頁：頭像／簡介／加入時間只有對方設為公開才會有，貼文與活動則一律列出最近幾筆。
// 「留言給 TA」不另開私訊表，送進對方的通知中心，對方點通知會回到留言者的個人頁。
@Component({
  selector: 'app-member-profile',
  standalone: true,
  imports: [SocialWidthToggleComponent, CommonModule, FormsModule, RouterLink, BoardIconComponent, LucideArrowLeft, LucideCalendarDays, LucideFileText, LucideMessageCircle, LucideSend, LucideTrophy, LucideUserRound],
  templateUrl: './member-profile.html',
  styleUrls: ['../social-common.scss', './member-profile.scss']
})
export class MemberProfileComponent implements OnChanges {
  // 路由參數 :id 由 withComponentInputBinding() 綁定
  @Input() id!: string;

  private socialApi = inject(SocialApiService);
  private meApi = inject(MeApiService);
  private cdr = inject(ChangeDetectorRef);

  readonly boardLabel = boardLabel;
  readonly eventMode = eventMode;
  readonly messageMax = MESSAGE_MAX;
  readonly excerpt = (post: SocialPostListItem): string => stripSocialMarkup(post.contentPreview).slice(0, 90);

  profile: SocialMemberProfile | null = null;
  posts: SocialPostListItem[] = [];
  events: EventListItem[] = [];
  loading = true;
  loadError: string | null = null;
  avatarFailed = false;

  message = '';
  sending = false;
  sentNotice = false;
  sendError: string | null = null;

  get isSelf(): boolean {
    return this.meApi.me()?.id === this.id;
  }

  get signedIn(): boolean {
    return !!this.meApi.me();
  }

  /** 橫幅沒有圖片，用暱稱算出固定的色相：每位會員的顏色不同，但每次看到都一樣。 */
  get hue(): number {
    let h = 0;
    for (const ch of this.profile?.nickname ?? '') h = (h * 31 + ch.charCodeAt(0)) % 360;
    return h;
  }

  ngOnChanges(): void {
    this.load();
  }

  send(): void {
    const content = this.message.trim();
    if (!content || this.sending) return;
    this.sending = true;
    this.sendError = null;
    this.sentNotice = false;
    this.socialApi.sendMemberMessage(this.id, content).subscribe({
      next: () => {
        this.message = '';
        this.sending = false;
        this.sentNotice = true;
        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        this.sending = false;
        this.sendError = error.error?.detail ?? (error.status === 429 ? '留言太頻繁，請稍後再試。' : '送出失敗，請稍後再試。');
        this.cdr.detectChanges();
      }
    });
  }

  private load(): void {
    this.loading = true;
    this.loadError = null;
    this.avatarFailed = false;
    this.sentNotice = false;
    forkJoin({
      profile: this.socialApi.getMember(this.id),
      posts: this.socialApi.getPosts({ userId: this.id, postType: 'POST', pageSize: 10 }),
      events: this.socialApi.getEvents({ organizerUserId: this.id, pageSize: 6 })
    }).subscribe({
      next: ({ profile, posts, events }) => {
        this.profile = profile;
        this.posts = posts.items;
        this.events = events.items;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        this.loadError = error.status === 404 ? '找不到這位會員。' : '會員頁面載入失敗，請稍後再試。';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }
}
