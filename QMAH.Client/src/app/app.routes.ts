import { Routes } from '@angular/router';

// 前台功能依責任建立 lazy loading route，統一由此集中管理。
export const routes: Routes = [
  {
    path: "store",
    children: [
      {
        path: "",
        loadComponent: () => import("./store/pages").then(c => c.Home)
      },
      // 商品列表頁支援 q（關鍵字）、cat（器類）、view（主題入口）三個查詢字串參數，
      // 由 withComponentInputBinding() 直接綁定到同名的元件 input。
      {
        path: "products",
        loadComponent: () => import("./store/pages").then(c => c.ProductList)
      },
      // 商品頁以路徑參數帶入商品 ID，同樣由 withComponentInputBinding() 綁定到 id input。
      {
        path: "product/:id",
        loadComponent: () => import("./store/pages").then(c => c.ProductInfo)
      },
      {
        path: "cart",
        loadComponent: () => import("./store/pages").then(c => c.Cart)
      },
      {
        path: "checkout",
        loadComponent: () => import("./store/pages").then(c => c.Checkout)
      },
    ]
  }
];
// import { Routes } from '@angular/router';
// import { Home } from './page/home/home';
// import { Cart } from './page/cart/cart';
// import { ProductList } from './page/product-list/product-list';
// import { ProductInfo } from './page/product-info/product-info';
// import { Checkout } from './page/checkout/checkout';

// // 前台功能依責任建立 lazy loading route，統一由此集中管理。
// export const routes: Routes = [
//   { path: '', component: Home },
//   // 商品列表頁支援 q（關鍵字）、cat（器類）、view（主題入口）三個查詢字串參數，
//   // 由 withComponentInputBinding() 直接綁定到同名的元件 input。
//   { path: 'products', component: ProductList },
//   // 商品頁以路徑參數帶入商品 ID，同樣由 withComponentInputBinding() 綁定到 id input。
//   { path: 'product/:id', component: ProductInfo },
//   { path: 'cart', component: Cart },
//   { path: 'checkout', component: Checkout },
// ];
