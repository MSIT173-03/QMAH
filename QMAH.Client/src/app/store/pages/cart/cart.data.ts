import { CartItem } from '../../api/api.models';

/**
 * 購物車頁的顯示資料換算。
 * 購物車內容、再加購商品與所有金額皆由 API 取得（見 store/api）。
 */

/** 供 app-cart-line 顯示用的購物車行資料 */
export interface CartLineData {
  id: string;
  coverImage: string | null;
  brand: string;
  cat: string;
  name: string;
  dims: string;
  /** 折扣後單價 */
  price: number;
  /** 折扣前原價，無折扣時為 null（不顯示劃線價，亦代表無折扣） */
  was: number | null;
  qty: number;
  /** 此行小計 */
  lineTotal: number;
  /** 是否正在執行移除動畫（淡出並收合列高），結束後才真正從購物車移除 */
  leaving: boolean;
}

/** 依購物車品項與是否正在移除中，換算成購物車行資料 */
export function toCartLineData(item: CartItem, leaving: boolean): CartLineData {
  return {
    id: item.productId,
    coverImage: item.coverImage,
    brand: item.brand,
    cat: item.category,
    name: item.name,
    dims: item.dimensions,
    price: item.price,
    was: item.originalPrice,
    qty: item.qty,
    lineTotal: item.lineTotal,
    leaving,
  };
}
