import {
  ChangeDetectorRef,
  Component,
  OnInit
} from '@angular/core';

import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../../../environments/environment';
import { BackToMember } from '../../../shared/back-to-member/back-to-member';
import { QmahIconComponent } from '../../../shared/components/qmah-icon/qmah-icon';

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
    CommonModule,
    ReactiveFormsModule,
    BackToMember,
    QmahIconComponent
  ],
  templateUrl: './profile.html',
  styleUrl: './profile.scss'
})
export class Profile implements OnInit {

  profile: MemberProfile | null = null;

  profileForm: FormGroup;

  loading = true;
  saving = false;
  avatarUnavailable = false;

  editMode = false;

  errorMessage = '';
  successMessage = '';

  constructor(
    private http: HttpClient,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {

    this.profileForm = this.fb.group({

      nickname: [
        '',
        [
          Validators.required,
          Validators.maxLength(50)
        ]
      ],

      bio: [
        '',
        [
          Validators.maxLength(500)
        ]
      ],

      visibility: [
        'PRIVATE',
        [
          Validators.required
        ]
      ]

    });

  }

  ngOnInit(): void {
    this.loadProfile();
  }

  // =========================
  // 載入會員資料
  // =========================

  loadProfile(): void {

    this.loading = true;
    this.errorMessage = '';

    this.http
      .get<MemberProfile>(
        `${environment.apiBaseUrl}/me`
      )
      .subscribe({

        next: (data) => {

          this.profile = data;
          this.avatarUnavailable = false;

          this.profileForm.patchValue({

            nickname:
              data.displayName ?? '',

            bio:
              data.bio ?? '',

            visibility:
              data.visibility ?? 'PRIVATE'

          });

          this.loading = false;

          this.cdr.detectChanges();

        },

        error: (error) => {

          console.error(
            'load profile error:',
            error
          );

          this.loading = false;

          this.errorMessage =
            '會員資料載入失敗。';

          this.cdr.detectChanges();

        }

      });

  }

  // =========================
  // 開始編輯
  // =========================

  startEdit(): void {

    if (!this.profile) {
      return;
    }

    this.successMessage = '';
    this.errorMessage = '';

    this.profileForm.patchValue({

      nickname:
        this.profile.displayName ?? '',

      bio:
        this.profile.bio ?? '',

      visibility:
        this.profile.visibility ?? 'PRIVATE'

    });

    this.editMode = true;

  }

  // =========================
  // 取消編輯
  // =========================

  cancelEdit(): void {

    this.editMode = false;

    this.errorMessage = '';
    this.successMessage = '';

    if (!this.profile) {
      return;
    }

    this.profileForm.patchValue({

      nickname:
        this.profile.displayName ?? '',

      bio:
        this.profile.bio ?? '',

      visibility:
        this.profile.visibility ?? 'PRIVATE'

    });

  }

  // =========================
  // 儲存會員資料
  // =========================

  saveProfile(): void {

    this.errorMessage = '';
    this.successMessage = '';

    if (this.profileForm.invalid) {

      this.profileForm.markAllAsTouched();

      return;
    }

    const request: UpdateProfileRequest = {

      nickname:
        this.profileForm.value.nickname.trim(),

      bio:
        this.profileForm.value.bio?.trim()
          ? this.profileForm.value.bio.trim()
          : null,

      visibility:
        this.profileForm.value.visibility

    };

    this.saving = true;

    this.http
      .put(
        `${environment.apiBaseUrl}/me/profile`,
        request,
        {
          responseType: 'text'
        }
      )
      .subscribe({

        next: () => {

          this.saving = false;

          this.editMode = false;

          this.successMessage =
            '會員資料已更新。';

          // 更新完重新抓一次最新資料
          this.reloadAfterSave();

        },

        error: (error) => {

          console.error(
            'update profile error:',
            error
          );

          this.saving = false;

          if (error.status === 400) {

            this.errorMessage =
              '資料格式不正確，請重新確認。';

          } else if (error.status === 401) {

            this.errorMessage =
              '登入狀態已失效，請重新登入。';

          } else {

            this.errorMessage =
              '會員資料更新失敗，請稍後再試。';

          }

          this.cdr.detectChanges();

        }

      });

  }

  private reloadAfterSave(): void {

    this.http
      .get<MemberProfile>(
        `${environment.apiBaseUrl}/me`
      )
      .subscribe({

        next: (data) => {

          this.profile = data;
          this.avatarUnavailable = false;

          this.profileForm.patchValue({

            nickname:
              data.displayName ?? '',

            bio:
              data.bio ?? '',

            visibility:
              data.visibility ?? 'PRIVATE'

          });

          this.cdr.detectChanges();

        },

        error: (error) => {

          console.error(
            'reload profile error:',
            error
          );

          this.cdr.detectChanges();

        }

      });

  }

  // =========================
  // 顯示用
  // =========================

  getInitial(): string {

    const name =
      this.profile?.displayName?.trim();

    if (!name) {
      return '?';
    }

    return name.charAt(0).toUpperCase();

  }

  getVisibilityText(
    visibility: string
  ): string {

    switch (visibility) {

      case 'PUBLIC':
        return '公開';

      case 'FRIENDS':
        return '僅好友';

      case 'PRIVATE':
        return '不公開';

      default:
        return visibility;

    }

  }

  getStatusText(
    status: string
  ): string {

    switch (status) {

      case 'ACTIVE':
        return '正常';

      case 'SUSPENDED':
        return '停權';

      case 'DISABLED':
        return '停用';

      default:
        return status;

    }

  }

}
