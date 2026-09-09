import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login')
        .then(m => m.Login)
  },
  {
    path: 'member',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/user/member-home/member-home')
        .then(m => m.MemberHome)
  }
];
