import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

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
      this.dailyActivity?.currentLoginStreak ?? 0;

    const completedCount =
      Math.min(streak, 7);

    return Array.from(
      { length: 7 },
      (_, index) => {

        const day = index + 1;

        return {
          day,

          completed:
            day <= completedCount,

          current:
            this.dailyActivity?.hasLoggedInToday === true &&
            day === completedCount,

          reward:
            day === 7
        };

      }
    );
  }


  private loadDailyActivity(): void {

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
      this.loggingIn ||
      this.dailyActivity?.hasLoggedInToday
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


  private sendDailyLogin(): void {

    this.http.post(
      `${environment.apiBaseUrl}/me/daily-activity/login`,
      {}
    )
      .subscribe({

        next: (response) => {

          // console.log('daily login success:', response);

          this.loggingIn = false;

          this.successMessage =
            '今日登入紀錄成功！';

          this.loadDailyActivity();

          this.cdr.detectChanges();

        },

        error: (error) => {

          console.error(
            'daily login error:',
            error
          );

          this.loggingIn = false;

          this.errorMessage =
            '記錄每日登入失敗';

          this.cdr.detectChanges();

        }

      });

  }

}
