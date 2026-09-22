import { Component } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { QmahIconComponent } from '../../../shared/components/qmah-icon/qmah-icon';

interface RegisterRequest {
  email: string;
  nickname: string;
  password: string;
  confirmPassword: string;
}

interface LoginRequest {
  email: string;
  password: string;
  rememberMe: boolean;
}

@Component({
  selector: 'app-register',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    QmahIconComponent
  ],
  templateUrl: './register.html',
  styleUrl: './register.scss'
})
export class Register {

  registerForm: FormGroup;

  submitting = false;
  errorMessage = '';

  showPassword = false;
  showConfirmPassword = false;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router
  ) {

    this.registerForm = this.fb.group({

      email: [
        '',
        [
          Validators.required,
          Validators.email
        ]
      ],

      nickname: [
        '',
        [
          Validators.required,
          Validators.maxLength(50)
        ]
      ],

      password: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.maxLength(100),

          // 至少 1 個大寫英文
          Validators.pattern(/(?=.*[A-Z])/),

          // 至少 1 個小寫英文
          Validators.pattern(/(?=.*[a-z])/),

          // 至少 1 個數字
          Validators.pattern(/(?=.*\d)/),

          // 至少 1 個特殊符號
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

  }

  // =========================
  // 顯示 / 隱藏密碼
  // =========================

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword =
      !this.showConfirmPassword;
  }

  // =========================
  // 密碼內容
  // =========================

  get passwordValue(): string {
    return this.registerForm
      .get('password')
      ?.value ?? '';
  }

  get confirmPasswordValue(): string {
    return this.registerForm
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
  // 註冊
  // =========================

  register(): void {

    this.errorMessage = '';

    if (this.registerForm.invalid) {

      this.registerForm.markAllAsTouched();

      return;
    }

    if (!this.passwordValid) {

      this.errorMessage =
        '密碼格式不符合要求。';

      return;
    }

    if (!this.passwordsMatch) {

      this.errorMessage =
        '兩次輸入的密碼不一致。';

      return;
    }

    const request: RegisterRequest = {

      email:
        this.registerForm.value.email.trim(),

      nickname:
        this.registerForm.value.nickname.trim(),

      password:
        this.passwordValue,

      confirmPassword:
        this.confirmPasswordValue

    };

    this.submitting = true;

    // 先取得 XSRF Token
    this.http
      .get(
        '/api/v1/account/antiforgery-token',
        {
          responseType: 'text'
        }
      )
      .subscribe({

        next: () => {

          this.submitRegister(
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

        }

      });

  }

  // =========================
  // 送出註冊
  // =========================

  private submitRegister(
    request: RegisterRequest
  ): void {

    this.http
      .post(
        '/api/v1/account/register',
        request,
        {
          responseType: 'text'
        }
      )
      .subscribe({

        // 註冊成功後直接自動登入
        next: () => {

          // integration: 註冊流程不依賴此開發期除錯輸出，先註解避免正式環境留下流程雜訊。
          // console.log('register success');

          this.autoLogin(
            request.email,
            request.password
          );

        },

        error: (error) => {

          console.error(
            'register error:',
            error
          );

          this.submitting = false;

          if (
            error.status === 400 &&
            error.error?.errors?.Password
          ) {

            this.errorMessage =
              error.error.errors.Password[0];

            return;
          }

          if (error.status === 400) {

            this.errorMessage =
              '註冊資料不符合規則，請確認 Email、暱稱與密碼。';

            return;
          }

          if (error.status === 409) {

            this.errorMessage =
              '這個 Email 已經註冊過了。';

            return;
          }

          if (error.status === 429) {

            this.errorMessage =
              '操作太頻繁，請稍後再試。';

            return;
          }

          this.errorMessage =
            '註冊失敗，請稍後再試。';

        }

      });

  }

  // =========================
  // 註冊成功後自動登入
  // =========================

  private autoLogin(
    email: string,
    password: string
  ): void {

    const loginRequest: LoginRequest = {
      email: email,
      password: password,
      rememberMe: false
    };

    this.http
      .post(
        '/api/v1/account/login',
        loginRequest,
        {
          responseType: 'text'
        }
      )
      .subscribe({

        next: () => {

          // console.log('auto login success');

          this.submitting = false;

          // 直接進會員中心
          this.router.navigate([
            '/member'
          ]);

        },

        error: (error) => {

          console.error(
            'auto login error:',
            error
          );

          this.submitting = false;

          alert(
            '帳號已建立成功，但自動登入失敗，請手動登入。'
          );

          this.router.navigate([
            '/login'
          ]);

        }

      });

  }

}
