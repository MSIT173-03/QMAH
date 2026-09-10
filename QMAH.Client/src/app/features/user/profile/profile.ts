import {
  ChangeDetectorRef,
  Component,
  OnInit
} from '@angular/core';

import {
  HttpClient,
  HttpErrorResponse
} from '@angular/common/http';

import { FormsModule } from '@angular/forms';

import { BackToMember } from '../../../shared/back-to-member/back-to-member';

import {
  environment
} from '../../../../environments/environment';

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

interface UpdateProfileRequest {
  nickname: string;
  bio: string | null;
  visibility: string;
}

@Component({
  selector: 'app-profile',
  imports: [
    FormsModule,
    BackToMember
  ],
  templateUrl: './profile.html',
  styleUrl: './profile.scss'
})
export class Profile implements OnInit {

  profile: MemberProfile | null = null;

  loading = true;
  saving = false;
  editing = false;

  errorMessage = '';
  successMessage = '';

  formData: UpdateProfileRequest = {
    nickname: '',
    bio: null,
    visibility: 'PRIVATE'
  };

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

    this.http
      .get<MemberProfile>(
        `${environment.apiBaseUrl}/me`
      )
      .subscribe({

        next: (data: MemberProfile) => {

          console.log(
            '會員資料：',
            data
          );

          this.profile = data;
          this.loading = false;

          this.cdr.detectChanges();
        },

        error: (error: HttpErrorResponse) => {

          console.error(
            '取得會員資料失敗：',
            error
          );

          this.profile = null;

          this.errorMessage =
            '無法取得會員資料';

          this.loading = false;

          this.cdr.detectChanges();
        }

      });
  }

  startEdit(): void {

    if (!this.profile) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    this.formData = {
      nickname: this.profile.displayName,
      bio: this.profile.bio,
      visibility: this.profile.visibility
    };

    this.editing = true;

    this.cdr.detectChanges();
  }

  cancelEdit(): void {

    this.editing = false;

    this.errorMessage = '';
    this.successMessage = '';

    this.cdr.detectChanges();
  }

  saveProfile(): void {

    if (this.saving) {
      return;
    }

    if (!this.formData.nickname.trim()) {
      this.errorMessage = '暱稱不可為空白';
      return;
    }

    this.saving = true;

    this.errorMessage = '';
    this.successMessage = '';

    const request: UpdateProfileRequest = {
      nickname: this.formData.nickname.trim(),
      bio:
        this.formData.bio?.trim()
          ? this.formData.bio.trim()
          : null,
      visibility: this.formData.visibility
    };

    this.http
      .put<MemberProfile>(
        `${environment.apiBaseUrl}/me/profile`,
        request
      )
      .subscribe({

        next: (data: MemberProfile) => {

          console.log(
            '更新會員資料成功：',
            data
          );

          this.profile = data;

          this.saving = false;
          this.editing = false;

          this.successMessage =
            '個人資料更新成功';

          this.cdr.detectChanges();
        },

        error: (error: HttpErrorResponse) => {

          console.error(
            '更新會員資料失敗：',
            error
          );

          this.saving = false;

          if (error.status === 400) {

            this.errorMessage =
              '資料格式不正確';

          } else if (error.status === 401) {

            this.errorMessage =
              '登入狀態已失效';

          } else if (error.status === 403) {

            this.errorMessage =
              '目前帳號沒有修改權限';

          } else {

            this.errorMessage =
              '更新個人資料失敗';
          }

          this.cdr.detectChanges();
        }

      });
  }
}
