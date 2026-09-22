import {
  ChangeDetectorRef,
  Component
} from '@angular/core';

import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  ActivatedRoute,
  Router,
  RouterLink
} from '@angular/router';
import { QmahIconComponent } from '../../../shared/components/qmah-icon/qmah-icon';

interface ResetPasswordRequest {
  email: string;
  token: string;
  newPassword: string;
  confirmPassword: string;
}

@Component({
  selector: 'app-reset-password',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    QmahIconComponent
  ],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss'
})
export class ResetPassword {

  resetForm: FormGroup;

  submitting = false;
  errorMessage = '';

  email = '';
  token = '';

  showPassword = false;
  showConfirmPassword = false;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {

    this.resetForm = this.fb.group({

      newPassword: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.maxLength(100),

          Validators.pattern(/(?=.*[A-Z])/),
          Validators.pattern(/(?=.*[a-z])/),
          Validators.pattern(/(?=.*\d)/),
          Validators.pattern(/(?=.*[^A-Za-z0-9])/)
        ]
      ],

      confirmPassword: [
        '',
        [
          Validators.required
        ]
      ]

    });

    this.email =
      this.route.snapshot.queryParamMap.get('email')
      ?? '';

    this.token =
      this.route.snapshot.queryParamMap.get('token')
      ?? '';

  }

  // =========================
  // 顯示 / 隱藏密碼
  // =========================

  togglePassword(): void {
    this.showPassword =
      !this.showPassword;
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword =
      !this.showConfirmPassword;
  }

  // =========================
  // 密碼值
  // =========================

  get passwordValue(): string {
    return this.resetForm
      .get('newPassword')
      ?.value ?? '';
  }

  get confirmPasswordValue(): string {
    return this.resetForm
      .get('confirmPassword')
      ?.value ?? '';
  }

  // =========================
  // 密碼規則
  // =========================

  get hasMinLength(): boolean {
    return this.passwordValue.length >= 8;
  }

  get hasUppercase(): boolean {
    return /[A-Z]/.test(
      this.passwordValue
    );
  }

  get hasLowercase(): boolean {
    return /[a-z]/.test(
      this.passwordValue
    );
  }

  get hasNumber(): boolean {
    return /\d/.test(
      this.passwordValue
    );
  }

  get hasSpecialCharacter(): boolean {
    return /[^A-Za-z0-9]/.test(
      this.passwordValue
    );
  }

  get passwordValid(): boolean {

    return (
      this.hasMinLength &&
      this.hasUppercase &&
      this.hasLowercase &&
      this.hasNumber &&
      this.hasSpecialCharacter &&
      this.passwordValue.length <= 100
    );

  }

  // =========================
  // 確認密碼
  // =========================

  get passwordsMatch(): boolean {

    return (
      this.confirmPasswordValue.length > 0 &&
      this.passwordValue ===
      this.confirmPasswordValue
    );

  }

  // =========================
  // 是否有合法連結資料
  // =========================

  get hasResetInfo(): boolean {
    return (
      this.email.length > 0 &&
      this.token.length > 0
    );
  }

  // =========================
  // 送出重設
  // =========================

  submit(): void {

    this.errorMessage = '';

    if (!this.hasResetInfo) {

      this.errorMessage =
        '密碼重設連結無效，請重新申請忘記密碼。';

      return;
    }

    if (this.resetForm.invalid) {

      this.resetForm.markAllAsTouched();

      return;
    }

    if (!this.passwordValid) {

      this.errorMessage =
        '新密碼格式不符合要求。';

      return;
    }

    if (!this.passwordsMatch) {

      this.errorMessage =
        '兩次輸入的密碼不一致。';

      return;
    }

    const request: ResetPasswordRequest = {

      email: this.email,

      token: this.token,

      newPassword: this.passwordValue,

      confirmPassword:
        this.confirmPasswordValue

    };

    this.submitting = true;

    // 先取得 antiforgery token
    this.http
      .get(
        '/api/v1/account/antiforgery-token',
        {
          responseType: 'text'
        }
      )
      .subscribe({

        next: () => {

          this.sendResetPassword(
            request
          );

        },

        error: (error) => {

          console.error(
            'antiforgery error:',
            error
          );

          this.submitting = false;

          this.errorMessage =
            '取得安全驗證資訊失敗，請稍後再試。';

          this.cdr.detectChanges();

        }

      });

  }

  private sendResetPassword(
    request: ResetPasswordRequest
  ): void {

    this.http
      .post(
        '/api/v1/account/reset-password',
        request,
        {
          responseType: 'text'
        }
      )
      .subscribe({

        next: () => {

          this.submitting = false;

          alert(
            '密碼重設成功，請使用新密碼登入。'
          );

          this.router.navigate([
            '/login'
          ]);

        },

        error: (error) => {

          console.error(
            'reset password error:',
            error
          );

          this.submitting = false;

          if (error.status === 400) {

            this.errorMessage =
              '重設連結無效、已過期，或新密碼不符合規則。';

          } else if (error.status === 429) {

            this.errorMessage =
              '操作太頻繁，請稍後再試。';

          } else {

            this.errorMessage =
              '密碼重設失敗，請稍後再試。';

          }

          this.cdr.detectChanges();

        }

      });

  }

}
