import { Product } from '../api/api.models';
import { formatDiscountTag, formatMoney, formatNumber } from './format';

/** 各頁面商品卡片、橫列、推薦區塊共用的商品顯示資料 */
export interface ProductViewData {
  id: string;
  /** 器類名稱 */
  cat: string;
  brand: string;
  name: string;
  /** 折扣後售價 */
  price: number;
  /** 折扣前原價，無折扣時為 null（不顯示劃線價，亦代表無折扣） */
  was: number | null;
  rating: number;
  reviews: number;
  sold: number;
  /** 尺寸／規格說明 */
  dims: string;
  /** 紋樣／器型出處說明 */
  source: string;
  /** 商品主圖網址，無圖片時為 null */
  coverImage: string | null;
}

/** 折扣前原價；指定 SalePrice 時也要顯示原價，不能只看 DiscountRate。 */
export function wasPrice(product: Product): number | null {
  return product.dealPrice < product.price ? product.price : null;
}

/** 依商品資料換算成商品顯示資料 */
export function toProductView(product: Product): ProductViewData {
  return {
    id: product.id,
    cat: product.category,
    brand: product.brand,
    name: product.name,
    price: product.dealPrice,
    was: wasPrice(product),
    rating: product.rating,
    reviews: product.reviewCount,
    sold: product.soldCount,
    dims: product.dimensions,
    source: product.source,
    coverImage: product.coverImage,
  };
}

/** 價格列的顯示字串（商品卡片、商品橫列、購物車行、商品頁資訊欄共用） */
export interface PriceView {
  /** 是否為折扣商品；有原價可比較即代表有折扣，價格顏色與標籤樣式皆以此判斷 */
  hasDeal: boolean;
  /** 折扣後售價（$ 開頭、千分位） */
  price: string;
  /** 折扣前原價（$ 開頭、千分位），無折扣時為 null */
  was: string | null;
  /** 折扣標籤文字 */
  tag: string;
}

/** 依售價與原價換算價格列的顯示字串 */
export function toPriceView(price: number, was: number | null): PriceView {
  return {
    hasDeal: was !== null,
    price: formatMoney(price),
    was: was === null ? null : formatMoney(was),
    tag: formatDiscountTag(price, was),
  };
}

/** 評分顯示字串，固定一位小數 */
export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

/** 評論數顯示字串，suffix 為評論數之後的文字 */
export function formatReviews(reviews: number, suffix = '則評論'): string {
  return `${formatNumber(reviews)} ${suffix}`;
}
