/**
 * 商品型錄後端 API 的原始回應格式，對應 doc/apis.xml 中「商品清單」「商品」「商品評論列表」三支 API 的定義。
 * 後端目前只提供這些欄位；品牌、折扣、評分（清單）、已售件數、上架日期、材質、保存狀況、出貨說明、商品圖片集等
 * 前端顯示用欄位尚未由後端提供，由 toProduct／toProductDetail 轉換時補上預設值。
 */

import { Product, ProductDetail, Review, ReviewPage, ReviewQuery } from './api.models';

/**
 * 器類代碼（categoryCode）與中文器類名稱對照表；宣告順序需與後端 StoreCatalogController.CategoryType
 * enum 一致，商品清單查詢的 category 參數即以此順序的索引值（數字）表示器類。
 */
const CATEGORIES: readonly [code: string, label: string][] = [
  ['BRONZE', '青銅器'],
  ['CARVING', '雕刻'],
  ['CERAMIC', '陶瓷'],
  ['COIN', '錢幣'],
  ['ENAMEL', '琺瑯器'],
  ['JADE', '玉器'],
  ['LACQUER', '漆器'],
  ['PAINTING', '繪畫'],
];

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(CATEGORIES);
const CATEGORY_CODE_BY_LABEL: Record<string, number> = Object.fromEntries(
  CATEGORIES.map(([, label], index) => [label, index]),
);

/** 將後端器類代碼轉為中文器類名稱，對應表未列出時直接沿用原文 */
function toCategoryLabel(categoryCode: string): string {
  return CATEGORY_LABELS[categoryCode] ?? categoryCode;
}

/**
 * 將中文器類名稱轉為商品清單查詢 API 的 category 參數（對應後端 CategoryType enum 的數字代碼）；
 * 對照表未列出時傳回 undefined，呼叫端應改為不送出此篩選條件。
 */
export function toCategoryCode(label: string): number | undefined {
  return CATEGORY_CODE_BY_LABEL[label];
}

/** GET /products 清單項目 */
export interface ApiProductListItem {
  id: string;
  artifactId: string;
  externalRef: string | null;
  name: string;
  categoryCode: string;
  price: number;
  stock: number;
  primaryImagePath: string | null;
  isActive: boolean;
}

/** GET /products 回應 */
export interface ApiProductPage {
  items: ApiProductListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

/** GET /products/{id} 回應 */
export interface ApiProductDetail {
  id: string;
  artifactId: string;
  artifactRef: string | null;
  artifactName: string | null;
  externalRef: string | null;
  name: string;
  categoryCode: string;
  description: string;
  sizeText: string;
  price: number;
  stock: number;
  primaryImagePath: string | null;
  sourceUrl: string | null;
  isActive: boolean;
  averageRating: number;
  reviewCount: number;
}

export function toProduct(dto: ApiProductListItem): Product {
  return {
    id: dto.id,
    name: dto.name,
    brand: '',
    category: toCategoryLabel(dto.categoryCode),
    price: dto.price,
    dealPrice: dto.price,
    discountRate: 0,
    rating: 0,
    reviewCount: 0,
    soldCount: 0,
    source: dto.externalRef ?? '',
    dimensions: '',
    listedAt: '',
    coverImage: dto.primaryImagePath,
  };
}

export function toProductDetail(dto: ApiProductDetail): ProductDetail {
  return {
    ...toProduct(dto),
    rating: dto.averageRating,
    reviewCount: dto.reviewCount,
    dimensions: dto.sizeText,
    source: dto.sourceUrl ?? dto.externalRef ?? '',
    material: '',
    description: dto.description,
    condition: '',
    shippingNote: '',
    images: dto.primaryImagePath ? [{ view: '商品', url: dto.primaryImagePath }] : [],
  };
}

/** GET /products/{productId}/reviews 清單項目 */
export interface ApiProductReview {
  id: string;
  productId: string;
  userId: string;
  displayName: string | null;
  rating: number;
  content: string;
  isVerifiedPurchase: boolean;
  createdAt: string;
  updatedAt: string;
}

/** GET /products/{productId}/reviews 回應 */
export interface ApiProductReviewsResponse {
  summary: {
    averageRating: number;
    reviewCount: number;
  };
  reviews: {
    items: ApiProductReview[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

function toReview(dto: ApiProductReview): Review {
  return {
    id: dto.id,
    stars: Math.round(dto.rating),
    user: dto.displayName ?? '匿名會員',
    date: dto.createdAt.slice(0, 10),
    // 後端評論資料沒有照片欄位，一律視為無照片。
    hasPhoto: false,
    text: dto.content,
  };
}

/**
 * 將後端評論回應轉為前端的 ReviewPage：後端只支援分頁（見 doc/apis.xml），不支援依星等／照片篩選，
 * 也不提供各星等則數與附照片則數。呼叫端會以夠大的 pageSize 一次取回全部評論，此函式在前端計算篩選、
 * 分頁與統計；商品評論超過該次取回筆數時，篩選與統計僅涵蓋已取回的部分。
 */
export function toReviewPage(res: ApiProductReviewsResponse, query: ReviewQuery): ReviewPage {
  const all = res.reviews.items.map(toReview);

  const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;
  for (const review of all) ratingBreakdown[review.stars as 1 | 2 | 3 | 4 | 5] += 1;

  const minStars = query.minStars ?? 1;
  const maxStars = query.maxStars ?? 5;
  const matched = all.filter(
    (review) =>
      review.stars >= minStars && review.stars <= maxStars && (!query.hasPhoto || review.hasPhoto),
  );

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? matched.length;
  return {
    items: matched.slice((page - 1) * pageSize, page * pageSize),
    total: matched.length,
    page,
    pageSize,
    ratingBreakdown,
    // 後端評論資料沒有照片欄位，附照片則數固定為 0。
    photoCount: 0,
  };
}
