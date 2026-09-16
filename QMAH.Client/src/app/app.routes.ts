import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
// 前台功能依責任建立 lazy loading route，統一由此集中管理。
export const routes: Routes = [
  {
    path: 'artifact-list',
    loadComponent: () => import('./artifact-list/artifact-list').then(m => m.ArtifactList)
  },

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
  },

  {
    path: 'member/daily-activity',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/user/daily-activity/daily-activity')
        .then(m => m.DailyActivity)
  },

  {
    path: 'member/addresses',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/user/addresses/addresses')
        .then(m => m.Addresses)
  },

  {
    path: 'member/coupons',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/user/coupons/coupons')
        .then(m => m.Coupons)
  },

  {
    path: 'member/notifications',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/user/notifications/notifications')
        .then(m => m.Notifications)
  },

  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register')
        .then(m => m.Register)
  },

  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password')
        .then(m => m.ForgotPassword)
  },

  {
    path: 'reset-password',
    loadComponent: () =>
      import(
        './features/auth/reset-password/reset-password'
      )
        .then(
          m => m.ResetPassword
        )
  },

];

