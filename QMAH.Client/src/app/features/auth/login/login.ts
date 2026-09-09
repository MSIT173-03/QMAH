import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-login',
  imports: [
    CommonModule,
    ReactiveFormsModule
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
    private http: HttpClient,
    private router: Router
  ) {
    this.form = this.fb.nonNullable.group({
      email: ['', [
        Validators.required,
        Validators.email
      ]],
      password: ['', [
        Validators.required
      ]],
      rememberMe: [false]
    });
  }

  login(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.http.get(
      `${environment.apiBaseUrl}/account/antiforgery-token`
    ).subscribe({
      next: () => {
        this.sendLogin();
      },
      error: () => {
        this.loading = false;
        this.errorMessage = '無法連線到伺服器';
      }
    });
  }

  private sendLogin(): void {
    this.http.post(
      `${environment.apiBaseUrl}/account/login`,
      this.form.getRawValue()
    ).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/member']);
      },
      error: (error) => {
        this.loading = false;

        if (error.status === 401) {
          this.errorMessage = 'Email 或密碼錯誤';
          return;
        }

        if (error.status === 503) {
          this.errorMessage = '資料庫目前無法連線';
          return;
        }

        this.errorMessage = '登入失敗，請稍後再試';
      }
    });
  }
}
