import { Component } from '@angular/core';
import {
  Router,
  RouterLink
} from '@angular/router';

import {
  AuthService
} from '../../../core/auth/auth.service';

@Component({
  selector: 'app-member-home',

  imports: [
    RouterLink
  ],

  templateUrl: './member-home.html',
  styleUrl: './member-home.scss'
})
export class MemberHome {

  loggingOut = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) { }


  logout(): void {

    if (this.loggingOut) {
      return;
    }

    this.loggingOut = true;

    this.authService
      .logout()
      .subscribe({

        next: () => {

          this.loggingOut = false;

          this.router.navigate([
            '/login'
          ]);

        },

        error: (error) => {

          this.loggingOut = false;

          console.error(
            '登出失敗：',
            error
          );

          alert(
            '登出失敗，請稍後再試'
          );

        }

      });

  }

}
