import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { MeApiService } from '../../../core/services/me-api';
import { QmahIconComponent } from '../../../shared/components/qmah-icon/qmah-icon';
import { MemberApi } from '../../../store/api/member.api';

interface DailyBrief {
  hasCheckedInToday: boolean;
  currentCheckInStreak: number;
  dailyPointReward: number;
}

/** 上次看到的數字：回到會員中心時先用這份秒顯示，再背景更新（只存在記憶體，登出或重新整理就清掉） */
const lastSeen: { points: number | null; coupons: number | null; unread: number | null; daily: DailyBrief | null; userId: string | null } =
  { points: null, coupons: null, unread: null, daily: null, userId: null };

/** 會員中心首頁：右上角的四張卡顯示即時數字（點數、折價券、連續簽到、未讀通知），各自連到對應子頁 */
@Component({
  selector: 'app-member-home',
  imports: [RouterLink, QmahIconComponent],
  templateUrl: './member-home.html',
  styleUrl: './member-home.scss',
})
export class MemberHome {
  private readonly http = inject(HttpClient);
  private readonly memberApi = inject(MemberApi);
  private readonly meApi = inject(MeApiService);

  // 換了帳號就不沿用別人的數字
  private readonly cached = lastSeen.userId === (this.meApi.me()?.id ?? null) ? lastSeen : null;
  protected readonly points = signal<number | null>(this.cached?.points ?? null);
  protected readonly couponCount = signal<number | null>(this.cached?.coupons ?? null);
  protected readonly unread = signal<number | null>(this.cached?.unread ?? null);
  protected readonly daily = signal<DailyBrief | null>(this.cached?.daily ?? null);

  protected readonly dailyText = computed(() => {
    const d = this.daily();
    if (!d) return '—';
    return d.hasCheckedInToday ? `連續 ${d.currentCheckInStreak} 天` : `+${d.dailyPointReward} 點`;
  });
  protected readonly dailyNote = computed(() => (this.daily()?.hasCheckedInToday ? '今天已簽到' : '今日可領取'));

  constructor() {
    lastSeen.userId = this.meApi.me()?.id ?? null;
    this.memberApi.getProfile().pipe(catchError(() => of(null))).subscribe((p) => { if (p) { this.points.set(p.pointBalance); lastSeen.points = p.pointBalance; } });
    this.memberApi.getCoupons().pipe(catchError(() => of(null))).subscribe((c) => { if (c) { this.couponCount.set(c.length); lastSeen.coupons = c.length; } });
    this.meApi.getNotifications({ page: 1, pageSize: 1 }).pipe(catchError(() => of(null))).subscribe((n) => { if (n) { this.unread.set(n.unreadCount); lastSeen.unread = n.unreadCount; } });
    this.http.get<DailyBrief>(`${environment.apiBaseUrl}/me/daily-activity`).pipe(catchError(() => of(null))).subscribe((d) => { if (d) { this.daily.set(d); lastSeen.daily = d; } });
  }
}
