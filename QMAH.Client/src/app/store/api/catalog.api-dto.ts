/**
 * 商品型錄後端 API 的原始回應格式，對應 doc/apis.xml 中「商品清單」「商品」「商品評論列表」三支 API 的定義。
 * 後端目前只提供這些欄位；品牌、評分（清單）、已售件數、上架日期、材質、保存狀況、出貨說明、商品圖片集等
 * 前端顯示用欄位由 toProduct／toProductDetail 依正式 API 契約轉換；沒有值時才使用中性 fallback。
 */

import { Category, Product, ProductDetail, Review, ReviewPage, ReviewQuery, StorePromotion } from './api.models';

/** 器類代碼（categoryCode）與中文器類名稱對照表 */
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
const CATEGORY_CODE_BY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(([code, label]) => [label, code]),
);

/** GET /categories 原始回應；後端的 Code 是篩選契約，Name 僅是資料庫顯示文字。 */
export interface ApiCategory {
  id: string;
  code: string;
  name: string;
  productCount: number;
}

/** 將後端器類代碼轉為中文器類名稱，對應表未列出時直接沿用原文 */
function toCategoryLabel(categoryCode: string): string {
  return CATEGORY_LABELS[categoryCode] ?? categoryCode;
}

/**
 * 將分類代碼正規化為前端共用名稱；資料庫可能回傳「銅器／陶瓷器」，
 * 但商品卡、麵包屑與篩選查詢必須共用同一組「青銅器／陶瓷」名稱。
 */
export function toCategory(dto: ApiCategory): Category {
  return { id: dto.id, name: toCategoryLabel(dto.code), productCount: dto.productCount };
}

/**
 * 圖鑑資料包把同一件文物的 display／thumbnail 放在同一個目錄；
 * 清單沿用後端既有 primaryImagePath，只替換檔名，避免為了縮圖再擴充 API 契約。
 */
export function toCatalogThumbnail(path: string | null): string | null {
  return path?.replace(/\/display\.jpg(?:\?.*)?$/i, '/thumbnail.jpg') ?? null;
}

/**
 * 將器類名稱轉回商品清單查詢 API 的 categoryCode 參數。
 * 對照表未列出的器類，toCategoryLabel 會直接沿用後端代碼當名稱，因此反查不到時原樣送出；
 * 不可略過篩選，否則使用者選了器類卻看到全部商品。
 */
export function toCategoryCode(label: string): string {
  return CATEGORY_CODE_BY_LABEL[label] ?? label;
}

/** GET /products 清單項目 */
export interface ApiProductListItem {
  id: string;
  artifactId: string | null;
  externalRef: string | null;
  name: string;
  categoryCode: string;
  price: number;
  discountRate: number;
  effectivePrice: number;
  salePrice?: number | null;
  stock: number;
  primaryImagePath: string | null;
  createdAt: string;
  averageRating: number;
  reviewCount: number;
  sellCount: number;
}

/** GET /products 回應 */
export interface ApiProductPage {
  items: ApiProductListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

/** GET /store/promotions：與社群公告共用的官方商城活動。 */
export interface ApiStorePromotion {
  id: string;
  title: string;
  content: string;
  publishedAt: string;
}

export function toStorePromotion(dto: ApiStorePromotion): StorePromotion {
  return {
    id: dto.id,
    title: dto.title,
    content: dto.content,
    publishedAt: dto.publishedAt,
  };
}

/** GET /products/{id} 回應 */
export interface ApiProductDetail {
  id: string;
  artifactId: string | null;
  artifactRef: string | null;
  artifactName: string | null;
  externalRef: string | null;
  name: string;
  categoryCode: string;
  description: string | null;
  sizeText: string | null;
  artifactSizeText: string | null;
  price: number;
  discountRate: number;
  effectivePrice: number;
  salePrice?: number | null;
  stock: number;
  primaryImagePath: string | null;
  sourceUrl: string | null;
  isActive: boolean;
  averageRating: number;
  reviewCount: number;
}
/** 清單與詳情共有的商品欄位 */
type ApiProductBase = Pick<
  ApiProductListItem,
  'id' | 'name' | 'categoryCode' | 'price' | 'discountRate' | 'effectivePrice' | 'externalRef' | 'primaryImagePath'
>;
export function toProduct(dto: ApiProductListItem | ApiProductDetail): Product {
  const dealPrice = dto.effectivePrice;
  // 商品詳情 API 沒有清單專用的上架時間／已售數欄位；不把它們誤當成清單的正式統計值。
  const listedAt = 'createdAt' in dto ? dto.createdAt : '';
  const soldCount = 'sellCount' in dto ? dto.sellCount : 0;
  return {
    id: dto.id,
    name: dto.name,
    brand: '',
    category: toCategoryLabel(dto.categoryCode),
    price: dto.price,
    dealPrice: dto.effectivePrice,
    discountRate: dto.discountRate,
    rating: dto.averageRating,
    reviewCount: dto.reviewCount,
    soldCount,
    source: dto.externalRef ?? '',
    dimensions: '',
    listedAt,
    // 清單只取 200px 縮圖；商品詳情會在 toProductDetail 還原成 600px display 圖。
    coverImage: toCatalogThumbnail(dto.primaryImagePath),
  };
}

/**
 * 商品 API 的 description 仍包含商城展示用的整合文字；明信片只取最後的故宮原文物說明。
 * 若舊資料沒有標記，才退回完整說明，避免測試資料或未完成資料被靜默清空。
 */
function toArtifactDescription(description: string | null): string {
  if (!description?.trim()) return '官方資料未提供';
  const marker = '原文物說明：';
  const markerIndex = description.lastIndexOf(marker);
  return (markerIndex >= 0 ? description.slice(markerIndex + marker.length) : description).trim();
}

export function toProductDetail(dto: ApiProductDetail): ProductDetail {
  const description = dto.description ?? '';
  const artifactDescription = toArtifactDescription(description);
  return {
    ...toProduct(dto),
    // 套組商品名稱保留在商品摘要；明信片正面改用原文物名稱，避免把販售形式印到作品標題上。
    artifactName: dto.artifactName ?? dto.name,
    // 詳情頁明確使用大圖，讓滿版明信片不會誤拿清單縮圖放大。
    coverImage: dto.primaryImagePath,
    artifactDimensions: dto.artifactSizeText ?? '官方資料未提供',
    rating: dto.averageRating,
    reviewCount: dto.reviewCount,
    dimensions: dto.sizeText ?? '官方資料未提供',
    source: dto.sourceUrl ?? dto.externalRef ?? '',
    material: '',
    // 商品說明保留套組段落；明信片視圖另用 artifactDescription，避免把行銷段落塞進卡片。
    description: dto.description?.trim() || '官方資料未提供',
    artifactDescription,
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

export function toReview(dto: ApiProductReview): Review {
  return {
    id: dto.id,
    // 後端 Rating 有 1–5 的驗證；仍夾在範圍內，避免異常資料讓星等統計寫到不存在的鍵。
    stars: Math.min(5, Math.max(1, Math.round(dto.rating))),
    user: dto.displayName ?? '匿名會員',
    date: dto.createdAt.slice(0, 10),
    text: dto.content,
  };
}

/**
 * 將商品的全部評論轉為前端的 ReviewPage：後端只支援分頁（見 doc/apis.xml），不支援依星等篩選，
 * 也不提供各星等則數，因此由 CatalogApi.getReviews 取回全部評論後，在前端計算篩選、分頁與統計。
 */
export function toReviewPage(all: Review[], query: ReviewQuery): ReviewPage {
  const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;
  for (const review of all) ratingBreakdown[review.stars as 1 | 2 | 3 | 4 | 5] += 1;

  const minStars = query.minStars ?? 1;
  const maxStars = query.maxStars ?? 5;
  const matched = all.filter((review) => review.stars >= minStars && review.stars <= maxStars);

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? matched.length;
  return {
    items: matched.slice((page - 1) * pageSize, page * pageSize),
    total: matched.length,
    page,
    pageSize,
    ratingBreakdown,
  };
}
