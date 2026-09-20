import { isDevMode } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
import { adminGameTestGuard, adminTestRoomGuard } from './core/guards/game-test-guard';

// integration: User 與 Catalog 的既有頁面共用 ASP.NET Core Identity route guard，
// 讓會員資料、圖鑑解鎖與鑰匙背包都沿用同一個登入狀態，不建立第二套前端權限判斷。
// 展示頁仍只在 development mode 登記；正式的遊戲檢查中心則由 Admin guard 保護，讓它能長期存在於部署版本。
const appShellChildren: Routes = [
  {
    // ui-integration: 登入後與網站根路徑都有明確的內容型首頁，讓使用者能從同一個入口重新選擇 Area。
    path: 'home',
    loadComponent: () => import('./features/home/home').then(m => m.HomeComponent)
  },
  {
    // ui-integration: 維持五個前台 Area 的既有 lazy route 與頁面組成，統一由同一個前台 App Shell 承載主導航。
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
    // ui-integration: 將多人與單人玩法的操作說明獨立成可切換入口，避免大廳同時承擔找房與教學內容。
    path: 'game/how-to',
    loadComponent: () =>
      import('./game/game-guide.component').then(({ GameGuideComponent }) => GameGuideComponent)
  },
  {
    path: 'game/rooms',
    loadComponent: () =>
      import('./game/game-lobby.component').then(({ GameLobbyComponent }) => GameLobbyComponent)
  },
  {
    path: 'game/room/:roomId',
    canActivate: [adminTestRoomGuard],
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
          canActivate: [adminGameTestGuard],
          loadComponent: () =>
            import('./game/game-lobby.component').then(({ GameLobbyComponent }) => GameLobbyComponent)
        }
      ]
    : []),
  {
    // ui-integration: 遊戲檢查中心是正式網站的一部分，但只讓管理員進入，避免把隔離測試工具混入一般玩家流程。
    path: 'game/test',
    canActivate: [adminGameTestGuard],
    loadComponent: () =>
      import('./game/game-test.component').then(({ GameTestComponent }) => GameTestComponent)
  },
  {
    path: 'social',
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
    children: [
      // integration: 管理頁面也採 lazy loading；管理功能不會在一般使用者進入貼文牆時一併下載。
      { path: 'events', loadComponent: () => import('./features/admin/admin-events/admin-events').then(m => m.AdminEventsComponent) },
      { path: 'reports', loadComponent: () => import('./features/admin/admin-reports/admin-reports').then(m => m.AdminReportsComponent) },
      { path: 'posts', loadComponent: () => import('./features/admin/admin-posts/admin-posts').then(m => m.AdminPostsComponent) },
      { path: 'comments', loadComponent: () => import('./features/admin/admin-comments/admin-comments').then(m => m.AdminCommentsComponent) }
    ]
  },
  {
    // integration: Store 保留自己的頁面 header 與內容組成，但改由共用前台 shell 提供跨 Area 主入口。
    path: 'store',
    children: [
      {
        path: '',
        loadComponent: () => import('./store/pages/home/home').then((c) => c.Home),
      },
      // 商品列表頁支援 q（關鍵字）、cat（器類）、view（主題入口）三個查詢字串參數，
      // 由 withComponentInputBinding() 直接綁定到同名的元件 input。
      {
        path: 'products',
        loadComponent: () => import('./store/pages/product-list/product-list').then((c) => c.ProductList),
      },
      // 商品頁以路徑參數帶入商品 ID，同樣由 withComponentInputBinding() 綁定到 id input。
      {
        path: 'product/:id',
        loadComponent: () => import('./store/pages/product-info/product-info').then((c) => c.ProductInfo),
      },
      {
        path: 'cart',
        loadComponent: () => import('./store/pages/cart/cart').then((c) => c.Cart),
      },
      {
        path: 'checkout',
        loadComponent: () => import('./store/pages/checkout/checkout').then((c) => c.Checkout),
      },
    ],
  },
  {
    // ui-integration: 政策頁與所有前台內容共用 App Shell，頁尾連結因此能保留主導航與 mobile drawer。
    path: 'privacy-policy',
    loadComponent: () => import('./shared/components/legal-page/legal-page').then(m => m.LegalPageComponent),
    data: { document: 'privacy' },
  },
  {
    path: 'terms',
    loadComponent: () => import('./shared/components/legal-page/legal-page').then(m => m.LegalPageComponent),
    data: { document: 'terms' },
  },
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: '**', redirectTo: 'home' }
];

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then(m => m.Login)
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
    // ui-integration: 主要前台共用同一個 App Shell；維持所有既有 URL 與 lazy children，讓 Area 切換不再更換網站骨架。
    path: '',
    loadComponent: () => import('./shared/components/layout/layout').then(m => m.LayoutComponent),
    children: appShellChildren
  }
];
