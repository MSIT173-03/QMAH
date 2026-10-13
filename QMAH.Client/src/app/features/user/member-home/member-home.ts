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

  protected readonly points = signal<number | null>(null);
  protected readonly couponCount = signal<number | null>(null);
  protected readonly unread = signal<number | null>(null);
  protected readonly daily = signal<DailyBrief | null>(null);

  protected readonly dailyText = computed(() => {
    const d = this.daily();
    if (!d) return '—';
    return d.hasCheckedInToday ? `連續 ${d.currentCheckInStreak} 天` : `+${d.dailyPointReward} 點`;
  });
  protected readonly dailyNote = computed(() => (this.daily()?.hasCheckedInToday ? '今天已簽到' : '今日可領取'));

  constructor() {
    this.memberApi.getProfile().pipe(catchError(() => of(null))).subscribe((p) => this.points.set(p ? p.pointBalance : null));
    this.memberApi.getCoupons().pipe(catchError(() => of(null))).subscribe((c) => this.couponCount.set(c ? c.length : null));
    this.meApi.getNotifications({ page: 1, pageSize: 1 }).pipe(catchError(() => of(null))).subscribe((n) => this.unread.set(n ? n.unreadCount : null));
    this.http.get<DailyBrief>(`${environment.apiBaseUrl}/me/daily-activity`).pipe(catchError(() => of(null))).subscribe((d) => this.daily.set(d));
  }
}
