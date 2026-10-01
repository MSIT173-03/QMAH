import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { switchMap } from 'rxjs';

import { environment } from '../../../../environments/environment';

import { BackToMember } from '../../../shared/back-to-member/back-to-member';
import { QmahIconComponent } from '../../../shared/components/qmah-icon/qmah-icon';

interface DailyActivityResponse {
  lastLoginDate: string | null;
  hasLoggedInToday: boolean;
  totalLoginDays: number;
  currentLoginStreak: number;
  longestLoginStreak: number;
  lifetimeLoginRate: number;
  hasCheckedInToday: boolean;
  dailyPointReward: number;
  awardedPoints: number;
  currentCheckInStreak: number;
  remainingMonthlyBonuses: number;
  makeUpDays: { date: string; pointCost: number }[];
}

@Component({
  selector: 'app-daily-activity',

  imports: [
    CommonModule,
    BackToMember,
    QmahIconComponent
  ],

  templateUrl: './daily-activity.html',
  styleUrl: './daily-activity.scss',
})
export class DailyActivity implements OnInit {

  dailyActivity: DailyActivityResponse | null = null;

  loading = true;
  loggingIn = false;
  makingUp = false;
  selectedMakeUpDate = '';

  errorMessage = '';
  successMessage = '';

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadDailyActivity();
  }


  get streakDays() {

    const streak =
      this.dailyActivity?.currentCheckInStreak ?? 0;

    const completedCount =
      this.dailyActivity?.hasCheckedInToday && streak > 0
        ? ((streak - 1) % 7) + 1
        : streak % 7;

    return Array.from(
      { length: 7 },
      (_, index) => {

        const day = index + 1;

        return {
          day,

          completed:
            day <= completedCount,

          current:
            this.dailyActivity?.hasCheckedInToday === true &&
            day === completedCount,

          reward:
            day === 7
        };

      }
    );
  }


  loadDailyActivity(): void {

    this.loading = true;

    this.errorMessage = '';

    this.http.get<DailyActivityResponse>(
      `${environment.apiBaseUrl}/me/daily-activity`
    )
      .subscribe({

        next: (data) => {

          // integration: 每日活動資料由畫面消化，原本的開發期 console 輸出先停用。
          // console.log('dailyActivity:', data);

          this.dailyActivity = data;

          this.loading = false;

          this.cdr.detectChanges();

        },

        error: (error) => {

          console.error(
            'dailyActivity error:',
            error
          );

          this.errorMessage =
            '讀取每日登入資料失敗';

          this.loading = false;

          this.cdr.detectChanges();

        }

      });

  }


  loginToday(): void {

    if (
      this.loggingIn || this.makingUp ||
      !this.dailyActivity || this.dailyActivity.hasCheckedInToday
    ) {
      return;
    }

    this.loggingIn = true;

    this.errorMessage = '';

    this.successMessage = '';

    this.http.get(
      `${environment.apiBaseUrl}/account/antiforgery-token`
    )
      .subscribe({

        next: () => {

          this.sendDailyLogin();

        },

        error: (error) => {

          console.error(
            '取得 antiforgery token 失敗：',
            error
          );

          this.loggingIn = false;

          this.errorMessage =
            '無法取得安全驗證資訊';

          this.cdr.detectChanges();

        }

      });

  }

  get selectedMakeUpDay() {
    return this.dailyActivity?.makeUpDays?.find(day => day.date === this.selectedMakeUpDate);
  }

  makeUp(): void {
    const day = this.selectedMakeUpDay;
    if (!day || this.loggingIn || this.makingUp) return;
    this.makingUp = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.http.get(`${environment.apiBaseUrl}/account/antiforgery-token`).pipe(
      switchMap(() => this.http.post<DailyActivityResponse>(`${environment.apiBaseUrl}/me/daily-activity/make-up`,
        { targetDate: day.date, expectedPointCost: day.pointCost }))
    ).subscribe({
      next: response => {
        this.dailyActivity = response;
        this.selectedMakeUpDate = '';
        this.makingUp = false;
        this.successMessage = response.awardedPoints > 0
          ? `已補簽 ${day.date}，${day.pointCost === 0 ? '本次免費' : `扣除 ${day.pointCost} 點`}，實得 ${response.awardedPoints} 點。`
          : '這天已完成簽到，沒有重複扣點或發放獎勵。';
        this.cdr.detectChanges();
      },
      error: error => {
        this.makingUp = false;
        this.errorMessage = error.error?.detail || '補簽未完成，請稍後再試。';
        this.cdr.detectChanges();
      }
    });
  }


  private sendDailyLogin(): void {

    this.http.post<DailyActivityResponse>(
      `${environment.apiBaseUrl}/me/daily-activity/check-in`,
      {}
    )
      .subscribe({

        next: (response) => {

          // console.log('daily login success:', response);

          this.loggingIn = false;

          this.successMessage =
            response.awardedPoints > 0
              ? `簽到成功，已領取 ${response.awardedPoints} 點鑑定點數！`
              : '今日獎勵已領取，明天再回來簽到。';
          this.dailyActivity = response;

          this.cdr.detectChanges();

        },

        error: (error) => {

          console.error(
            'daily login error:',
            error
          );

          this.loggingIn = false;

          this.errorMessage =
            error.error?.detail || '簽到獎勵尚未領取，請稍後重試。';

          this.cdr.detectChanges();

        }

      });

  }

}
