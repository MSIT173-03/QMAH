import {
  ChangeDetectorRef,
  Component,
  OnInit,
  OnDestroy
} from '@angular/core';

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
import { environment } from '../../../../environments/environment';


// =========================
// Cloudflare Turnstile 型別
// =========================

declare global {

  interface Window {

    turnstile?: {

      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          theme?: 'light' | 'dark' | 'auto';
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
        }
      ) => string;

      reset: (
        widgetId?: string
      ) => void;

      remove: (
        widgetId: string
      ) => void;

    };

  }

}


// =========================
// Request Models
// =========================

interface RegisterRequest {
  email: string;
  nickname: string;
  password: string;
  confirmPassword: string;
  turnstileToken: string;
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
export class Register implements OnInit, OnDestroy {

  registerForm: FormGroup;

  submitting = false;
  errorMessage = '';

  showPassword = false;
  showConfirmPassword = false;


  // =========================
  // Cloudflare Turnstile
  // =========================

  turnstileToken = '';

  private turnstileWidgetId: string | null = null;

  private turnstileRetryTimer: ReturnType<typeof setTimeout> | null = null;


  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef
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
  // Component 初始化
  // =========================

  ngOnInit(): void {

    this.renderTurnstileWhenReady();

  }


  // =========================
  // Component 銷毀
  // =========================

  ngOnDestroy(): void {

    // 停止等待 Turnstile
    if (this.turnstileRetryTimer) {

      clearTimeout(
        this.turnstileRetryTimer
      );

      this.turnstileRetryTimer = null;

    }

    // 移除 Turnstile Widget
    if (
      this.turnstileWidgetId &&
      window.turnstile
    ) {

      try {

        window.turnstile.remove(
          this.turnstileWidgetId
        );

      }
      catch (error) {

        console.warn(
          'remove turnstile error:',
          error
        );

      }

    }

    this.turnstileWidgetId = null;
    this.turnstileToken = '';

  }


  // =========================
  // 顯示 Cloudflare Turnstile
  // =========================

  private renderTurnstileWhenReady(): void {

    const tryRender = () => {

      const container =
        document.getElementById(
          'turnstile-widget'
        );

      // Cloudflare JS 還沒載入
      // 或 Angular DOM 還沒建立完成
      if (
        !window.turnstile ||
        !container
      ) {

        this.turnstileRetryTimer =
          setTimeout(
            tryRender,
            100
          );

        return;

      }

      // 避免重複 Render
      if (this.turnstileWidgetId) {
        return;
      }

      try {

        this.turnstileWidgetId =
          window.turnstile.render(
            container,
            {

              sitekey:
                environment.turnstileSiteKey,

              theme:
                'dark',

              // =========================
              // 驗證成功
              // =========================

              callback: (
                token: string
              ) => {

                this.turnstileToken =
                  token;

                this.errorMessage =
                  '';

                this.cdr.detectChanges();

              },

              // =========================
              // Token 過期
              // =========================

              'expired-callback': () => {

                this.turnstileToken =
                  '';

                this.cdr.detectChanges();

              },

              // =========================
              // Turnstile 發生錯誤
              // =========================

              'error-callback': () => {

                this.turnstileToken =
                  '';

                this.errorMessage =
                  '安全驗證失敗，請重新驗證。';

                this.cdr.detectChanges();

              }

            }
          );

      }
      catch (error) {

        console.error(
          'Turnstile render error:',
          error
        );

        this.errorMessage =
          '安全驗證載入失敗，請重新整理頁面。';

        this.cdr.detectChanges();

      }

    };

    tryRender();

  }


  // =========================
  // 重設 Turnstile
  // =========================

  private resetTurnstile(): void {

    this.turnstileToken = '';

    if (
      this.turnstileWidgetId &&
      window.turnstile
    ) {

      try {

        window.turnstile.reset(
          this.turnstileWidgetId
        );

      }
      catch (error) {

        console.warn(
          'reset turnstile error:',
          error
        );

      }

    }

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

    return (
      this.passwordValue.length >= 8
    );

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


    // =========================
    // 表單驗證
    // =========================

    if (this.registerForm.invalid) {

      this.registerForm
        .markAllAsTouched();

      return;

    }


    // =========================
    // 密碼驗證
    // =========================

    if (!this.passwordValid) {

      this.errorMessage =
        '密碼格式不符合要求。';

      return;

    }


    // =========================
    // 確認密碼
    // =========================

    if (!this.passwordsMatch) {

      this.errorMessage =
        '兩次輸入的密碼不一致。';

      return;

    }


    // =========================
    // Turnstile 驗證
    // =========================

    if (!this.turnstileToken) {

      this.errorMessage =
        '請先完成安全驗證。';

      return;

    }


    // =========================
    // 建立 Request
    // =========================

    const request: RegisterRequest = {

      email:
        this.registerForm.value.email.trim(),

      nickname:
        this.registerForm.value.nickname.trim(),

      password:
        this.passwordValue,

      confirmPassword:
        this.confirmPasswordValue,

      turnstileToken:
        this.turnstileToken

    };


    this.submitting = true;


    // =========================
    // 先取得 XSRF Token
    // =========================

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

          this.cdr.detectChanges();

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

        // =========================
        // 註冊成功
        // =========================

        next: () => {

          this.autoLogin(
            request.email,
            request.password
          );

        },


        // =========================
        // 註冊失敗
        // =========================

        error: (error) => {

          console.error(
            'register error:',
            error
          );

          this.submitting = false;


          // Turnstile Token 通常為一次性使用
          // 失敗後重新驗證
          this.resetTurnstile();


          if (
            error.status === 400 &&
            error.error?.errors?.Password
          ) {

            this.errorMessage =
              error.error.errors.Password[0];

          }
          else if (
            error.status === 400
          ) {

            this.errorMessage =
              '註冊資料不符合規則，請確認 Email、暱稱、密碼與安全驗證。';

          }
          else if (
            error.status === 409
          ) {

            this.errorMessage =
              '這個 Email 已經註冊過了。';

          }
          else if (
            error.status === 429
          ) {

            this.errorMessage =
              '操作太頻繁，請稍後再試。';

          }
          else {

            this.errorMessage =
              '註冊失敗，請稍後再試。';

          }

          this.cdr.detectChanges();

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

      email:
        email,

      password:
        password,

      rememberMe:
        false

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

        // =========================
        // 自動登入成功
        // =========================

        next: () => {

          this.submitting = false;

          this.router.navigate([
            '/member'
          ]);

        },


        // =========================
        // 自動登入失敗
        // =========================

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
