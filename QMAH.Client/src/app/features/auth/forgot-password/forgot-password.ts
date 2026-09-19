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
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-forgot-password',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink
  ],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss'
})
export class ForgotPassword {

  forgotForm: FormGroup;

  submitting = false;
  successMessage = '';
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {

    this.forgotForm = this.fb.group({

      email: [
        '',
        [
          Validators.required,
          Validators.email,
          Validators.maxLength(256)
        ]
      ]

    });

  }

  submit(): void {

    this.successMessage = '';
    this.errorMessage = '';

    if (this.forgotForm.invalid) {

      this.forgotForm.markAllAsTouched();

      return;
    }

    const request = {
      email:
        this.forgotForm.value.email.trim()
    };

    this.submitting = true;

    this.http
      .get(
        '/api/v1/account/antiforgery-token',
        {
          responseType: 'text'
        }
      )
      .subscribe({

        next: () => {

          this.sendForgotPassword(
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

  private sendForgotPassword(
    request: {
      email: string;
    }
  ): void {

    this.http
      .post(
        '/api/v1/account/forgot-password',
        request,
        {
          responseType: 'text'
        }
      )
      .subscribe({

        next: () => {

          // integration: 密碼重設成功狀態由畫面訊息呈現，不需保留開發期 console 輸出。
          // console.log('forgot password success');

          this.submitting = false;

          this.successMessage =
            '如果這個 Email 有註冊帳號，系統將寄送密碼重設通知，請前往信箱查看。';

          this.cdr.detectChanges();

        },

        error: (error) => {

          console.error(
            'forgot password error:',
            error
          );

          this.submitting = false;

          if (error.status === 400) {

            this.errorMessage =
              'Email 格式不正確，請重新確認。';

          } else if (error.status === 429) {

            this.errorMessage =
              '操作太頻繁，請稍後再試。';

          } else {

            this.errorMessage =
              '系統目前無法處理密碼重設，請稍後再試。';

          }

          this.cdr.detectChanges();

        }

      });

  }

}
