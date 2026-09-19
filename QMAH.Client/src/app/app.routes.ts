import { isDevMode } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';

// integration: User 與 Catalog 的既有頁面共用 ASP.NET Core Identity route guard，
// 讓會員資料、圖鑑解鎖與鑰匙背包都沿用同一個登入狀態，不建立第二套前端權限判斷。
// Game 與 Social 的正式頁面共用同一個 App Shell；展示／API 測試頁只在 development mode 登記，避免部署環境暴露測試入口。
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then(m => m.Login)
  },
  {
    path: 'member',
    canActivate: [authGuard],
    loadComponent: () => import('./features/user/member-home/member-home').then(m => m.MemberHome)
  },
  {
    path: 'member/profile',
    canActivate: [authGuard],
    loadComponent: () => import('./features/user/profile/profile').then(m => m.Profile)
  },
  {
    path: 'member/economy',
    canActivate: [authGuard],
    loadComponent: () => import('./features/member/economy/economy').then(m => m.Economy)
  },
  {
    path: 'member/achievements',
    canActivate: [authGuard],
    loadComponent: () => import('./features/user/achievements/achievements').then(m => m.Achievements)
  },
  {
    path: 'member/daily-activity',
    canActivate: [authGuard],
    loadComponent: () => import('./features/user/daily-activity/daily-activity').then(m => m.DailyActivity)
  },
  {
    path: 'member/addresses',
    canActivate: [authGuard],
    loadComponent: () => import('./features/user/addresses/addresses').then(m => m.Addresses)
  },
  {
    path: 'member/coupons',
    canActivate: [authGuard],
    loadComponent: () => import('./features/user/coupons/coupons').then(m => m.Coupons)
  },
  {
    path: 'member/notifications',
    canActivate: [authGuard],
    loadComponent: () => import('./features/user/notifications/notifications').then(m => m.Notifications)
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register').then(m => m.Register)
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./features/auth/forgot-password/forgot-password').then(m => m.ForgotPassword)
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./features/auth/reset-password/reset-password').then(m => m.ResetPassword)
  },
  {
    path: 'artifact-list',
    canActivate: [authGuard],
    loadComponent: () => import('./artifact-list/artifact-list').then(m => m.ArtifactList)
  },
  {
    path: 'key-list',
    canActivate: [authGuard],
    loadComponent: () => import('./key-list/key-list').then(m => m.KeyList)
  },
  {
    path: 'game/account',
    loadComponent: () =>
      import('./game/game-account.component').then(({ GameAccountComponent }) => GameAccountComponent)
  },
  {
    path: 'game/training',
    loadComponent: () =>
      import('./game/game-training.component').then(({ GameTrainingComponent }) => GameTrainingComponent)
  },
  {
    path: 'game/minigames',
    loadComponent: () =>
      import('./game/game-training.component').then(({ GameTrainingComponent }) => GameTrainingComponent)
  },
  {
    path: 'game/rooms',
    loadComponent: () =>
      import('./game/game-lobby.component').then(({ GameLobbyComponent }) => GameLobbyComponent)
  },
  {
    path: 'game/room/:roomId',
    loadComponent: () =>
      import('./game/game-room.component').then(({ GameRoomComponent }) => GameRoomComponent)
  },
  {
    path: 'game',
    loadComponent: () =>
      import('./game/game-lobby.component').then(({ GameLobbyComponent }) => GameLobbyComponent)
  },
  ...(isDevMode()
    ? [
        {
          path: 'game/demo',
          loadComponent: () =>
            import('./game/game-lobby.component').then(({ GameLobbyComponent }) => GameLobbyComponent)
        },
        {
          path: 'game/test',
          loadComponent: () =>
            import('./game/game-test.component').then(({ GameTestComponent }) => GameTestComponent)
      }
    ]
    : []),
  {
    path: 'social',
    // integration: App Shell 本身只服務 Social/Admin，跟著父路由延遲載入，避免殼層也佔用一般登入頁的初始 bundle。
    loadComponent: () => import('./shared/components/layout/layout').then(m => m.LayoutComponent),
    children: [
      // integration: Social 頁面沿用既有 URL，但改成進入頁面時才載入，避免所有社群功能進入 initial bundle。
      { path: 'posts', loadComponent: () => import('./features/social/posts/posts').then(m => m.PostsComponent) },
      { path: 'posts/:id', loadComponent: () => import('./features/social/post-detail/post-detail').then(m => m.PostDetailComponent) },
      { path: 'events', loadComponent: () => import('./features/social/events/events').then(m => m.EventsComponent) },
      { path: 'events/:id', loadComponent: () => import('./features/social/event-detail/event-detail').then(m => m.EventDetailComponent) },
      { path: 'announcements', loadComponent: () => import('./features/social/announcements/announcements').then(m => m.AnnouncementsComponent) }
    ]
  },
  {
    path: 'admin',
    loadComponent: () => import('./shared/components/layout/layout').then(m => m.LayoutComponent),
    children: [
      // integration: 管理頁面也採 lazy loading；管理功能不會在一般使用者進入貼文牆時一併下載。
      { path: 'events', loadComponent: () => import('./features/admin/admin-events/admin-events').then(m => m.AdminEventsComponent) },
      { path: 'reports', loadComponent: () => import('./features/admin/admin-reports/admin-reports').then(m => m.AdminReportsComponent) },
      { path: 'posts', loadComponent: () => import('./features/admin/admin-posts/admin-posts').then(m => m.AdminPostsComponent) },
      { path: 'comments', loadComponent: () => import('./features/admin/admin-comments/admin-comments').then(m => m.AdminCommentsComponent) }
    ]
  },
  { path: '', redirectTo: 'social/posts', pathMatch: 'full' },
  { path: '**', redirectTo: 'social/posts' }
];
