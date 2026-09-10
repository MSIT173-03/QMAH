import { Injectable, signal } from '@angular/core';

export interface UserRole {
  name: string;
  role: 'User' | 'Admin';
  token: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  // 使用 Angular Signals 管理目前使用者狀態
  currentUser = signal<UserRole>({
    name: '一般玩家 (Alice)',
    role: 'User',
    token: 'mock-user-token'
  });

  switchUser(user: UserRole) {
    this.currentUser.set(user);
    localStorage.setItem('access_token', user.token);
    alert(`已切換身分至：${user.name} (${user.role})`);
  }

  isAdmin(): boolean {
    return this.currentUser().role === 'Admin';
  }
}
