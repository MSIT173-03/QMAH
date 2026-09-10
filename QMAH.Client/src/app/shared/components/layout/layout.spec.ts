import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { AuthService, UserRole } from '../../../core/services/auth';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  templateUrl: './layout.html',
  styleUrl: './layout.css'
})
export class LayoutComponent {
  auth = inject(AuthService);

  switch(role: 'User' | 'Admin') {
    const userMap: Record<string, UserRole> = {
      User: { name: '一般玩家 (Alice)', role: 'User', token: 'user-token' },
      Admin: { name: '系統管理員 (Admin)', role: 'Admin', token: 'admin-token' }
    };
    this.auth.switchUser(userMap[role]);
  }
}
