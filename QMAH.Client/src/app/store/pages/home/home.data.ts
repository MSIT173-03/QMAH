import { ProductCardBadgeVariant } from '../../component/product-card/product-card';
import { Product } from '../../api/api.models';

/**
 * 首頁的頁面選項定義與商品卡片資料換算。
 * 各版位的內容皆由 API 取得（見 src/app/api），本檔案僅保留前端行為設定。
 */

/** 熱銷排行分類分頁（第一項視為「全站」不篩選） */
export const RANKING_TABS = ['全站', '陶瓷', '青銅器', '玉器', '繪畫'];

/** 供 app-product-card 顯示用的商品卡片資料 */
export interface ProductCardData {
  id: string;
  badge: string;
  badgeVariant: ProductCardBadgeVariant;
  brand: string;
  name: string;
  /** 折扣後實際售價 */
  price: number;
  /** 折扣前原價，無折扣時為 null（卡片不顯示劃線價，也代表無折扣，不需另存強調色旗標） */
  was: number | null;
  rating: number;
  reviews: number;
  sold: number;
}

/** 數字補零至兩位，用於排行角標與倒數計時 */
export function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** 依商品資料換算成商品卡片所需欄位 */
export function toCardData(
  product: Product,
  badge: string,
  badgeVariant: ProductCardBadgeVariant = 'ink',
): ProductCardData {
  return {
    id: product.id,
    badge,
    badgeVariant,
    brand: product.brand,
    name: product.name,
    price: product.dealPrice,
    was: product.discountRate > 0 ? product.price : null,
    rating: product.rating,
    reviews: product.reviewCount,
    sold: product.soldCount,
  };
}
