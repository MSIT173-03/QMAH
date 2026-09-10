import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-member-home',
  imports: [RouterLink],
  templateUrl: './member-home.html',
  styleUrl: './member-home.scss'
})
export class MemberHome {

  loggingOut = false;

  constructor(
    private http: HttpClient,
    private router: Router
  ) { }

  logout(): void {
    this.loggingOut = true;

    this.http.get(
      `${environment.apiBaseUrl}/account/antiforgery-token`
    ).subscribe({
      next: () => {
        this.sendLogout();
      },
      error: () => {
        this.loggingOut = false;
        alert('無法取得安全驗證資訊');
      }
    });
  }

  private sendLogout(): void {
    this.http.post(
      `${environment.apiBaseUrl}/account/logout`,
      {}
    ).subscribe({
      next: () => {
        this.loggingOut = false;
        this.router.navigate(['/login']);
      },
      error: (error) => {
        this.loggingOut = false;
        console.error('登出失敗：', error);
        alert('登出失敗，請稍後再試');
      }
    });
  }
}
