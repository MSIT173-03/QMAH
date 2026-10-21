import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
import { adminGameTestGuard, adminTestRoomGuard } from './core/guards/game-test-guard';

// integration: User 與 Catalog 的既有頁面共用 ASP.NET Core Identity route guard，
// 讓會員資料、圖鑑解鎖與鑰匙背包都沿用同一個登入狀態，不建立第二套前端權限判斷。
// 展示頁仍只在 development mode 登記；正式的遊戲檢查中心則由 Admin guard 保護，讓它能長期存在於部署版本。
const appShellChildren: Routes = [
  {
    path: 'game/appreciation', title: '鑑賞回答｜清明鑑定屋',
    loadComponent: () => import('./game/game-appreciation.component').then(m => m.GameAppreciationComponent)
  },
  {
    // ui-integration: 登入後與網站根路徑都有明確的內容型首頁，讓使用者能從同一個入口重新選擇 Area。
    path: 'home', title: '清明鑑定屋｜文物鑑定遊戲',
    loadComponent: () => import('./features/home/home').then(m => m.HomeComponent)
  },
  {
    // ui-integration: 維持五個前台 Area 的既有 lazy route 與頁面組成，統一由同一個前台 App Shell 承載主導航。
    path: 'member', title: '會員中心｜清明鑑定屋',
    canActivate: [authGuard],
    loadComponent: () => import('./features/user/member-home/member-home').then(m => m.MemberHome)
  },
  {
    path: 'member/profile', title: '個人資料｜清明鑑定屋',
    canActivate: [authGuard],
    loadComponent: () => import('./features/user/profile/profile').then(m => m.Profile)
  },
  {
    path: 'member/security', title: '帳號安全｜清明鑑定屋',
    canActivate: [authGuard],
    loadComponent: () => import('./features/user/security/security').then(m => m.Security)
  },
  {
    path: 'member/economy', title: '點數與錢包｜清明鑑定屋',
    canActivate: [authGuard],
    loadComponent: () => import('./features/member/economy/economy').then(m => m.Economy)
  },
  {
    path: 'member/achievements', title: '成就｜清明鑑定屋',
    canActivate: [authGuard],
    loadComponent: () => import('./features/user/achievements/achievements').then(m => m.Achievements)
  },
  {
    path: 'member/daily-activity', title: '每日活動｜清明鑑定屋',
    canActivate: [authGuard],
    loadComponent: () => import('./features/user/daily-activity/daily-activity').then(m => m.DailyActivity)
  },
  {
    path: 'member/addresses', title: '收件地址｜清明鑑定屋',
    canActivate: [authGuard],
    loadComponent: () => import('./features/user/addresses/addresses').then(m => m.Addresses)
  },
  {
    path: 'member/coupons', title: '我的折價券｜清明鑑定屋',
    canActivate: [authGuard],
    loadComponent: () => import('./features/user/coupons/coupons').then(m => m.Coupons)
  },
  {
    path: 'member/notifications', title: '通知｜清明鑑定屋',
    canActivate: [authGuard],
    loadComponent: () => import('./features/user/notifications/notifications').then(m => m.Notifications)
  },
  {
    path: 'artifact-list', title: '文物圖鑑｜清明鑑定屋',
    canActivate: [authGuard],
    loadComponent: () => import('./artifact-list/artifact-list').then(m => m.ArtifactList)
  },
  {
    path: 'key-list', title: '鑰匙背包｜清明鑑定屋',
    canActivate: [authGuard],
    loadComponent: () => import('./key-list/key-list').then(m => m.KeyList)
  },
  { path: 'game/account', redirectTo: 'game', pathMatch: 'full' },
  {
    path: 'game/training', title: '單人小遊戲｜清明鑑定屋',
    loadComponent: () =>
      import('./game/game-training.component').then(({ GameTrainingComponent }) => GameTrainingComponent)
  },
  {
    path: 'game/minigames', title: '單人小遊戲｜清明鑑定屋',
    loadComponent: () =>
      import('./game/game-training.component').then(({ GameTrainingComponent }) => GameTrainingComponent)
  },
  {
    // ui-integration: 將多人與單人玩法的操作說明獨立成可切換入口，避免大廳同時承擔找房與教學內容。
    path: 'game/how-to', title: '遊戲說明｜清明鑑定屋',
    loadComponent: () =>
      import('./game/game-guide.component').then(({ GameGuideComponent }) => GameGuideComponent)
  },
  {
    path: 'game/rooms', title: '房間大廳｜清明鑑定屋',
    canActivate: [adminTestRoomGuard],
    runGuardsAndResolvers: 'paramsOrQueryParamsChange',
    loadComponent: () =>
      import('./game/game-lobby.component').then(({ GameLobbyComponent }) => GameLobbyComponent)
  },
  {
    path: 'game/room/:roomId', title: '遊戲房間｜清明鑑定屋',
    canActivate: [adminTestRoomGuard],
    runGuardsAndResolvers: 'paramsOrQueryParamsChange',
    loadComponent: () =>
      import('./game/game-room.component').then(({ GameRoomComponent }) => GameRoomComponent)
  },
  {
    path: 'game', title: '房間大廳｜清明鑑定屋',
    canActivate: [adminTestRoomGuard],
    runGuardsAndResolvers: 'paramsOrQueryParamsChange',
    loadComponent: () =>
      import('./game/game-lobby.component').then(({ GameLobbyComponent }) => GameLobbyComponent)
  },
  {
    // ui-integration: 遊戲檢查中心是正式網站的一部分，但只讓管理員進入，避免把隔離測試工具混入一般玩家流程。
    path: 'game/test', title: '流程測試｜清明鑑定屋',
    canActivate: [adminGameTestGuard],
    loadComponent: () =>
      import('./game/game-lobby.component').then(({ GameLobbyComponent }) => GameLobbyComponent)
  },
  {
    path: 'social',
    children: [
      // integration: Social 頁面沿用既有 URL，但改成進入頁面時才載入，避免所有社群功能進入 initial bundle。
      { path: 'posts', title: '社群貼文牆｜清明鑑定屋', loadComponent: () => import('./features/social/posts/posts').then(m => m.PostsComponent) },
      { path: 'posts/:id', title: '貼文｜清明鑑定屋', loadComponent: () => import('./features/social/post-detail/post-detail').then(m => m.PostDetailComponent) },
      { path: 'events', title: '社群活動｜清明鑑定屋', loadComponent: () => import('./features/social/events/events').then(m => m.EventsComponent) },
      { path: 'events/:id', title: '活動｜清明鑑定屋', loadComponent: () => import('./features/social/event-detail/event-detail').then(m => m.EventDetailComponent) },
      { path: 'members/:id', title: '會員頁面｜清明鑑定屋', loadComponent: () => import('./features/social/member-profile/member-profile').then(m => m.MemberProfileComponent) },
      { path: 'announcements', title: '歷史公告｜清明鑑定屋', loadComponent: () => import('./features/social/announcements/announcements').then(m => m.AnnouncementsComponent) }
    ]
  },
  {
    // integration: Store 保留自己的頁面 header 與內容組成，但改由共用前台 shell 提供跨 Area 主入口。
    path: 'store',
    children: [
      {
        path: '', title: '購物商城｜清明鑑定屋',
        loadComponent: () => import('./store/pages/home/home').then((c) => c.Home),
      },
      {
        path: 'products', title: '商品列表｜清明鑑定屋',
        loadComponent: () => import('./store/pages/product-list/product-list').then((c) => c.ProductList),
      },
      {
        path: 'product/:id', title: '商品｜清明鑑定屋',
        loadComponent: () => import('./store/pages/product-info/product-info').then((c) => c.ProductInfo),
      },
      {
        path: 'coupons', title: '折價券兌換｜清明鑑定屋',
        loadComponent: () => import('./store/pages/coupon-store/coupon-store').then((c) => c.CouponStore),
      },
      {
        path: 'cart', title: '購物車｜清明鑑定屋',
        canActivate: [authGuard],
        loadComponent: () => import('./store/pages/cart/cart').then((c) => c.Cart),
      },
      {
        path: 'checkout', title: '結帳｜清明鑑定屋',
        canActivate: [authGuard],
        loadComponent: () => import('./store/pages/checkout/checkout').then((c) => c.Checkout),
      },
      {
        // 我的訂單：取消待付款訂單、重新前往綠界付款；綠界付款頁的「返回商店」也回到這裡。
        path: 'orders', title: '我的訂單｜清明鑑定屋',
        canActivate: [authGuard],
        loadComponent: () => import('./store/pages/orders/orders').then((c) => c.Orders),
      },
    ],
  },
  {
    // ui-integration: 政策頁與所有前台內容共用 App Shell，頁尾連結因此能保留主導航與 mobile drawer。
    path: 'privacy-policy', title: '隱私權政策｜清明鑑定屋',
    loadComponent: () => import('./shared/components/legal-page/legal-page').then(m => m.LegalPageComponent),
    data: { document: 'privacy' },
  },
  {
    path: 'terms', title: '服務條款｜清明鑑定屋',
    loadComponent: () => import('./shared/components/legal-page/legal-page').then(m => m.LegalPageComponent),
    data: { document: 'terms' },
  },
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: '**', title: '找不到頁面｜清明鑑定屋', loadComponent: () => import('./shared/components/not-found/not-found').then(m => m.NotFoundComponent) }
];

export const routes: Routes = [
  {
    path: 'verify-email', title: '驗證信箱｜清明鑑定屋',
    loadComponent: () => import('./features/auth/verify-email/verify-email').then(m => m.VerifyEmail)
  },
  {
    path: 'login', title: '登入｜清明鑑定屋',
    loadComponent: () => import('./features/auth/login/login').then(m => m.Login)
  },
  {
    path: 'register', title: '註冊｜清明鑑定屋',
    loadComponent: () => import('./features/auth/register/register').then(m => m.Register)
  },
  {
    path: 'forgot-password', title: '忘記密碼｜清明鑑定屋',
    loadComponent: () => import('./features/auth/forgot-password/forgot-password').then(m => m.ForgotPassword)
  },
  {
    path: 'reset-password', title: '重設密碼｜清明鑑定屋',
    loadComponent: () => import('./features/auth/reset-password/reset-password').then(m => m.ResetPassword)
  },
  {
    // ui-integration: 主要前台共用同一個 App Shell；維持所有既有 URL 與 lazy children，讓 Area 切換不再更換網站骨架。
    path: '',
    loadComponent: () => import('./shared/components/layout/layout').then(m => m.LayoutComponent),
    children: appShellChildren
  }
];
