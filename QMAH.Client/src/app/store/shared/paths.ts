/** 商店首頁路徑 */
export const HOME_PATH = '/store';
/** 商品列表頁路徑，供其他頁面連結至商品列表頁（可另帶 cat／view／q 等查詢字串）使用 */
export const PRODUCT_LIST_PATH = '/store/products';
/** 購物車頁路徑 */
export const CART_PATH = '/store/cart';
/** 結帳頁路徑 */
export const CHECKOUT_PATH = '/store/checkout';

/** 商品頁路徑 */
export function productPath(id: string): string {
  return `/store/product/${encodeURIComponent(id)}`;
}

/** 商品列表頁的搜尋結果路徑 */
export function searchPath(keyword: string): string {
  return `${PRODUCT_LIST_PATH}?q=${encodeURIComponent(keyword)}`;
}
