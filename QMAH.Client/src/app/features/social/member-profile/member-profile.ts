import { ChangeDetectorRef, Component, Input, OnChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';

import { EventListItem, SocialApiService, SocialMemberProfile, SocialPostListItem } from '../../../core/services/social-api';
import { LucideArrowLeft, LucideUserRound } from '@lucide/angular';

// 公開個人頁：頭像／簡介／加入時間只有對方設為公開才會有，貼文與活動則一律列出最近幾筆。
@Component({
  selector: 'app-member-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideArrowLeft, LucideUserRound],
  templateUrl: './member-profile.html',
  styleUrls: ['../social-common.scss', './member-profile.scss']
})
export class MemberProfileComponent implements OnChanges {
  // 路由參數 :id 由 withComponentInputBinding() 綁定
  @Input() id!: string;

  private socialApi = inject(SocialApiService);
  private cdr = inject(ChangeDetectorRef);

  profile: SocialMemberProfile | null = null;
  posts: SocialPostListItem[] = [];
  events: EventListItem[] = [];
  loading = true;
  loadError: string | null = null;
  avatarFailed = false;

  ngOnChanges(): void {
    this.load();
  }

  private load(): void {
    this.loading = true;
    this.loadError = null;
    this.avatarFailed = false;
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
