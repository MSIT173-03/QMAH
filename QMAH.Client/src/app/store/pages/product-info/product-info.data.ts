import { Product, ReviewPage, ReviewQuery } from '../../api/api.models';

/**
 * 商品頁的頁面選項定義與商品顯示資料換算。
 * 商品、評價、同類推薦與商品說明文案皆由 API 取得（見 src/app/api）；
 * 評價篩選在此只定義按鈕文字、對應的查詢參數與則數取法，實際篩選由後端執行。
 */

/** 同類推薦顯示的商品數量上限 */
export const RELATED_LIMIT = 5;

/* ===============================
   頁面選項定義（前端行為設定）
   =============================== */

/** 評價篩選條件 */
export interface ReviewFilter {
  /** 按鈕文字前綴，實際顯示會再接上符合條件的則數 */
  label: string;
  /** 對應評價 API 的查詢參數 */
  query: ReviewQuery;
  /** 由評價回應的統計資料取得符合此條件的則數 */
  count: (page: ReviewPage) => number;
}

/** 評價篩選條件清單，索引 0 為不篩選 */
export const REVIEW_FILTERS: ReviewFilter[] = [
  {
    label: '全部',
    query: {},
    count: (page) => Object.values(page.ratingBreakdown).reduce((sum, n) => sum + n, 0),
  },
  { label: '★5', query: { minStars: 5, maxStars: 5 }, count: (page) => page.ratingBreakdown[5] },
  { label: '★4', query: { minStars: 4, maxStars: 4 }, count: (page) => page.ratingBreakdown[4] },
  {
    label: '★3 以下',
    query: { maxStars: 3 },
    count: (page) => page.ratingBreakdown[1] + page.ratingBreakdown[2] + page.ratingBreakdown[3],
  },
  { label: '附照片', query: { hasPhoto: true }, count: (page) => page.photoCount },
];

/* ===============================
   換算工具
   =============================== */

/** 供同類推薦卡片顯示用的商品資料 */
export interface RelatedItemData {
  id: string;
  brand: string;
  name: string;
  /** 折扣後售價 */
  price: number;
  /** 折扣前原價，無折扣時為 null（不顯示劃線價，亦代表無折扣） */
  was: number | null;
  rating: number;
  reviews: number;
}

/** 依商品資料換算成同類推薦卡片資料 */
export function toRelatedItemData(product: Product): RelatedItemData {
  return {
    id: product.id,
    brand: product.brand,
    name: product.name,
    price: product.dealPrice,
    was: product.discountRate > 0 ? product.price : null,
    rating: product.rating,
    reviews: product.reviewCount,
  };
}
