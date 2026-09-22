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
import { QmahIconComponent } from '../../../shared/components/qmah-icon/qmah-icon';

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

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadAchievements();
  }

  get displayedAchievement(): Achievement | null {
    return this.achievements.find(
      achievement => achievement.isDisplayed
    ) ?? null;
  }

  getConditionTypeLabel(conditionType: string): string {

    switch (conditionType) {

      case 'DAILY_LOGIN_COUNT':
        return '累積登入天數';

      case 'CONSECUTIVE_LOGIN_COUNT':
        return '連續登入天數';

      default:
        return conditionType;
    }
  }

  private loadAchievements(): void {

    this.loading = true;
    this.errorMessage = '';

    this.http
      .get<Achievement[]>(
        '/api/v1/me/achievements'
      )
      .subscribe({

        next: (data: Achievement[]) => {

          // integration: 成就資料只需更新畫面，原本的開發期資料輸出先註解保留脈絡。
          // console.log('achievements:', data);

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
