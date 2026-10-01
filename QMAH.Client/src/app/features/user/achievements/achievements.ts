import {
  ChangeDetectorRef,
  Component,
  OnInit
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

import {
  BackToMember
} from '../../../shared/back-to-member/back-to-member';

import {
  QmahIconComponent
} from '../../../shared/components/qmah-icon/qmah-icon';


interface Achievement {
  id: string;
  achievementId: string;
  code: string;
  name: string;
  title: string;
  description: string | null;
  iconPath: string | null;
  conditionType: string;
  thresholdValue: number;
  achievedAt: string;
  isDisplayed: boolean;
  displayedAt: string | null;
}


@Component({
  selector: 'app-achievements',

  imports: [
    CommonModule,
    BackToMember,
    QmahIconComponent
  ],

  templateUrl: './achievements.html',
  styleUrl: './achievements.scss',
})
export class Achievements implements OnInit {

  achievements: Achievement[] = [];

  loading = true;

  errorMessage = '';

  // 正在設定中的成就 ID
  settingDisplayId: string | null = null;

  // 設定成功訊息
  successMessage = '';


  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) { }


  ngOnInit(): void {

    this.loadAchievements();

  }


  // ===============================
  // 目前展示中的稱號
  // ===============================

  get displayedAchievement(): Achievement | null {

    return this.achievements.find(
      achievement => achievement.isDisplayed
    ) ?? null;

  }


  // ===============================
  // 條件名稱
  // ===============================

  getConditionTypeLabel(
    conditionType: string
  ): string {

    switch (conditionType) {

      case 'DAILY_LOGIN_COUNT':
        return '累積登入天數';

      case 'CONSECUTIVE_LOGIN_COUNT':
        return '連續登入天數';

      default:
        return conditionType;

    }

  }


  // ===============================
  // 設定展示稱號
  // ===============================

  setDisplayedAchievement(
    achievement: Achievement
  ): void {

    // 已經是展示中的稱號，不需要再送一次
    if (achievement.isDisplayed) {
      return;
    }


    this.settingDisplayId =
      achievement.id;

    this.errorMessage = '';

    this.successMessage = '';


    this.http
      .put<Achievement>(
        `/api/v1/me/achievements/${achievement.id}/display`,
        {}
      )
      .subscribe({

        next: (updatedAchievement) => {

          // 更新前端狀態
          // 同一時間只能展示一個稱號
          this.achievements =
            this.achievements.map(item => ({

              ...item,

              isDisplayed:
                item.id === updatedAchievement.id,

              displayedAt:
                item.id === updatedAchievement.id
                  ? updatedAchievement.displayedAt
                  : null

            }));


          this.successMessage =
            `已將「${updatedAchievement.title}」設為展示稱號`;


          this.settingDisplayId = null;

          this.cdr.detectChanges();

        },


        error: (error) => {

          console.error(
            'set displayed achievement error:',
            error
          );


          this.errorMessage =
            '設定展示稱號失敗，請稍後再試';


          this.settingDisplayId = null;

          this.cdr.detectChanges();

        }

      });

  }


  // ===============================
  // 判斷是否正在設定這個稱號
  // ===============================

  isSettingDisplay(
    achievement: Achievement
  ): boolean {

    return this.settingDisplayId ===
      achievement.id;

  }


  // ===============================
  // 讀取會員成就
  // ===============================

  private loadAchievements(): void {

    this.loading = true;

    this.errorMessage = '';


    this.http
      .get<Achievement[]>(
        '/api/v1/me/achievements'
      )
      .subscribe({

        next: (data: Achievement[]) => {

          this.achievements = data;

          this.loading = false;

          this.cdr.detectChanges();

        },


        error: (error) => {

          console.error(
            'achievements error:',
            error
          );


          this.errorMessage =
            '讀取成就資料失敗';


          this.loading = false;

          this.cdr.detectChanges();

        }

      });

  }

}
