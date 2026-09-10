import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../../../environments/environment';

interface MemberProfile {
  id: string;
  email: string;
  displayName: string;
  bio: string | null;
  avatarPath: string | null;
  createdAt: string;
  pointBalance: number;
  roles: string[];
  status: string;
  visibility: string;
}

@Component({
  selector: 'app-profile',
  imports: [],
  templateUrl: './profile.html',
  styleUrl: './profile.scss'
})
export class Profile implements OnInit {

  profile: MemberProfile | null = null;
  loading = true;
  errorMessage = '';

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadProfile();
  }

  private loadProfile(): void {
    this.loading = true;
    this.errorMessage = '';

    this.http.get<MemberProfile>(
      `${environment.apiBaseUrl}/me`
    ).subscribe({
      next: (data) => {
        console.log('會員資料：', data);

        this.profile = data;
        this.loading = false;

        // 告訴 Angular 立即更新畫面
        this.cdr.detectChanges();
      },

      error: (error) => {
        console.error('取得會員資料失敗：', error);

        this.profile = null;
        this.errorMessage = '無法取得會員資料';
        this.loading = false;

        this.cdr.detectChanges();
      }
    });
  }
}
