import { Routes } from '@angular/router';

// 前台功能依責任建立 lazy loading route，統一由此集中管理。
// 各頁面個別 import，讓每個頁面各自打包成獨立的 lazy chunk。
export const routes: Routes = [
  {
    path: 'store',
    children: [
      {
        path: '',
        loadComponent: () => import('./store/pages/home/home').then((c) => c.HomePage),
      },
      // 商品列表頁支援 q（關鍵字）、cat（器類）、view（主題入口）三個查詢字串參數，
      // 由 withComponentInputBinding() 直接綁定到同名的元件 input。
      {
        path: 'products',
        loadComponent: () => import('./store/pages/product-list/product-list').then((c) => c.ProductListPage),
      },
      // 商品頁以路徑參數帶入商品 ID，同樣由 withComponentInputBinding() 綁定到 id input。
      {
        path: 'product/:id',
        loadComponent: () => import('./store/pages/product-detail/product-detail').then((c) => c.ProductDetailPage),
      },
      {
        path: 'cart',
        loadComponent: () => import('./store/pages/cart/cart').then((c) => c.CartPage),
      },
      {
        path: 'checkout',
        loadComponent: () => import('./store/pages/checkout/checkout').then((c) => c.CheckoutPage),
      },
    ],
  },
];
