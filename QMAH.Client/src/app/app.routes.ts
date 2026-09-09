import { Routes } from '@angular/router';

// 前台功能依責任建立 lazy loading route，統一由此集中管理。
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login')
        .then(m => m.Login)
  }
];
