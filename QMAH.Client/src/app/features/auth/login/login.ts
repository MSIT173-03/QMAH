import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import {
  Router,
  RouterLink
} from '@angular/router';

import {
  AuthService
} from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {

  loading = false;
  errorMessage = '';

  form;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {

    this.form = this.fb.nonNullable.group({

      email: [
        '',
        [
          Validators.required,
          Validators.email
        ]
      ],

      password: [
        '',
        [
          Validators.required
        ]
      ],

      rememberMe: [
        false
      ]

    });

  }


  login(): void {

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.loading) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.authService
      .login(
        this.form.getRawValue()
      )
      .subscribe({

        next: () => {

          this.loading = false;

          this.router.navigate([
            '/member'
          ]);

        },

        error: (error) => {

          this.loading = false;

          if (error.status === 401) {

            this.errorMessage =
              'Email 或密碼錯誤';

            return;
          }

          if (error.status === 503) {

            this.errorMessage =
              '資料庫目前無法連線';

            return;
          }

          this.errorMessage =
            '登入失敗，請稍後再試';

        }

      });

  }

}
