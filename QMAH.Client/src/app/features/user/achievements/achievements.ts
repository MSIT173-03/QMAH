import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

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
  imports: [CommonModule],
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

  private loadAchievements(): void {
    this.loading = true;
    this.errorMessage = '';

    this.http.get<Achievement[]>('/api/v1/me/achievements')
      .subscribe({
        next: (data) => {
          console.log('achievements:', data);

          this.achievements = data;
          this.loading = false;

          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('achievements error:', error);

          this.errorMessage = '讀取成就資料失敗';
          this.loading = false;

          this.cdr.detectChanges();
        }
      });
  }
}
