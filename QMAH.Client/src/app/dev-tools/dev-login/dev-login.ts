import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

import { environment } from '../../../environments/environment';

/**
 * 開發測試專用的登入小工具——直接呼叫既有的 /account/login、/account/antiforgery-token、
 * /account/logout，讓需要登入的 Social API（發文、留言、報名、後台審核…）在正式的會員登入
 * UI 完成前也能端到端測試。
 *
 * 移除方式（上線前）：
 *   1. 刪除整個 src/app/dev-tools 目錄
 *   2. 移除 layout.ts 對 DevLoginComponent 的 import，以及 layout.html 裡的 <app-dev-login />
 * 平常不移除的話，元件本身在 production build（environment.production === true）下也不會顯示。
 */
@Component({
  selector: 'app-dev-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dev-login.html',
  styleUrl: './dev-login.scss'
})
export class DevLoginComponent {
  private http = inject(HttpClient);

  isProduction = environment.production;

  email = 'admin@qmah.local';
  password = '';
  pending = false;
  message: string | null = null;

  // AccountController 繼承 ApiControllerBase，整個 controller（含 Login 本身）都套用
  // [AutoValidateAntiforgeryToken]，所以一定要先拿到 XSRF-TOKEN-API cookie 才能登入，
  // 順序不能反過來——先呼叫過 antiforgery-token，Angular 的 withXsrfConfiguration
  // 才會在後續的 login POST 自動帶上 X-XSRF-TOKEN header。
  login(): void {
    this.pending = true;
    this.message = null;

    this.http.get(`${environment.apiBaseUrl}/account/antiforgery-token`).subscribe({
      next: () => this.submitLogin(),
      error: () => {
        this.pending = false;
        this.message = '取得 XSRF token 失敗，請確認 QMAH.Api 是否已啟動。';
      }
    });
  }

  logout(): void {
    this.pending = true;
    this.http.post(`${environment.apiBaseUrl}/account/logout`, {}).subscribe({
      next: () => {
        this.pending = false;
        this.message = '已登出。';
      },
      error: () => {
        this.pending = false;
        this.message = '登出時發生錯誤，但本機登入狀態可能已清除。';
      }
    });
  }

  private submitLogin(): void {
    this.http.post(`${environment.apiBaseUrl}/account/login`, {
      email: this.email,
      password: this.password
    }).subscribe({
      next: () => {
        this.pending = false;
        this.message = `已登入：${this.email}`;
      },
      error: (err: HttpErrorResponse) => {
        this.pending = false;
        this.message = err.status === 401
          ? '登入失敗：帳號或密碼錯誤。'
          : '登入失敗，請確認 QMAH.Api 是否已啟動。';
      }
    });
  }
}
