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
  },

  {
    path: 'member/profile',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/user/profile/profile')
        .then(m => m.Profile)
  },

  {
    path: 'member/economy',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/member/economy/economy')
        .then(m => m.Economy)
  },

  {
  path: 'member/achievements',
  canActivate: [authGuard],
  loadComponent: () =>
    import('./features/user/achievements/achievements')
      .then(m => m.Achievements)
}

];
