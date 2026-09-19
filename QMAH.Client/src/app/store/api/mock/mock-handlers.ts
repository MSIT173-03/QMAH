import { HttpParams } from '@angular/common/http';
import {
  CheckoutOptions,
  Coupon,
  FlashSale,
  OrderQuote,
  OrderQuoteRequest,
  OrderRequest,
  OrderResult,
  Page,
  Product,
  RecommendedProduct,
  Review,
  ShoppingCart,
} from '../api.models';
import {
  ApiProductDetail,
  ApiProductListItem,
  ApiProductPage,
  ApiProductReview,
  ApiProductReviewsResponse,
} from '../catalog.api-dto';
import {
  ADDON_LIMIT,
  BRANDS,
  CATALOG,
  CATEGORIES,
  CLAIMABLE_COUPONS,
  CatalogRecord,
  DESCRIPTION_SUFFIX,
  FLASH_SALE_ITEMS,
  FLASH_SALE_REMAINING_MS,
  FREE_SHIPPING_THRESHOLD,
  HERO_SLIDES,
  HOT_SEARCH_LINKS,
  MEMBER,
  MEMBER_COUPONS,
  MOCK_STOCK,
  PAYMENT_OPTIONS,
  POINT_EARN_RATE,
  RECOMMENDATION_ORDER,
  RECOMMENDATION_REASONS,
  REVIEWS,
  SHIPPING_OPTIONS,
  SITE_CONFIG,
  SOLD_BASE,
  SOLD_STEP,
  SUGGESTION_COUNT_BASE,
  SUGGESTION_COUNT_STEP,
  SUGGESTION_SUFFIXES,
  cartQuantities,
} from './mock-db';

/**
 * 假 API 各端點的處理函式，模擬後端依請求參數查詢 mock-db 並組出回應內容。
 * 金額、折扣、已售件數與推薦排序等規則都在此計算，前端不再自行換算。
 */

/** 假 API 的錯誤回應，由攔截器轉為 HttpErrorResponse */
export class MockApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/* ===============================
   共用換算
   =============================== */

/** 依折扣比例換算實際售價（四捨五入至十元） */
function dealPrice(record: CatalogRecord): number {
  return Math.round((record.price * (1 - record.off)) / 10) * 10;
}

function findRecord(id: string): CatalogRecord {
  const record = CATALOG.find((item) => item.id === id);
  if (!record) throw new MockApiError(404, `找不到商品 ${id}`);
  return record;
}

function toProduct(record: CatalogRecord): Product {
  return {
    id: record.id,
    name: record.name,
    brand: record.brand,
    category: record.cat,
    price: record.price,
    dealPrice: dealPrice(record),
    discountRate: record.off,
    rating: record.rating,
    reviewCount: record.reviews,
    soldCount: SOLD_BASE + CATALOG.indexOf(record) * SOLD_STEP,
    source: record.source,
    dimensions: record.dims,
    listedAt: record.listedAt,
    coverImage: record.image ?? null,
  };
}

/** CatalogRecord → 後端「商品清單」DTO（見 doc/apis.xml），供 listProducts 使用 */
function toApiProduct(record: CatalogRecord): ApiProductListItem {
  return {
    id: record.id,
    artifactId: record.id,
    externalRef: null,
    name: record.name,
    categoryCode: record.cat,
    price: record.price,
    stock: MOCK_STOCK,
    primaryImagePath: record.image ?? null,
    isActive: true,
  };
}

/** CatalogRecord → 後端「商品」DTO（見 doc/apis.xml），供 getProduct 使用 */
function toApiProductDetail(record: CatalogRecord): ApiProductDetail {
  return {
    ...toApiProduct(record),
    artifactRef: record.id,
    artifactName: record.name,
    description: `${record.source}${DESCRIPTION_SUFFIX}\n\n文物原始尺寸：${record.artifactDims ?? '官方資料未提供'}`,
    sizeText: record.dims,
    artifactSizeText: record.artifactDims ?? '官方資料未提供',
    sourceUrl: null,
    averageRating: record.rating,
    reviewCount: record.reviews,
  };
}

function numberParam(params: HttpParams, key: string): number | undefined {
  const raw = params.get(key);
  if (raw === null) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new MockApiError(400, `${key} 必須是數字`);
  return value;
}

/** 依 page／pageSize 參數切出一頁，未指定 pageSize 時回傳全部 */
function paginate<T>(items: T[], params: HttpParams): Page<T> {
  const page = numberParam(params, 'page') ?? 1;
  const pageSize = numberParam(params, 'pageSize') ?? items.length;
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    total: items.length,
    page,
    pageSize,
  };
}

/* ===============================
   商品型錄與詳情
   =============================== */

export function listCategories() {
  return {
    categories: CATEGORIES.map((category) => ({
      ...category,
      productCount: CATALOG.filter((record) => record.cat === category.name).length,
    })),
  };
}

/**
 * GET /products：商品清單。回應為後端 DTO 格式（見 doc/apis.xml），由 CatalogApi 轉換為前端顯示用的 Product。
 * 僅支援後端已實作的篩選條件（關鍵字、器類代碼、分頁），排序與價格區間、限折扣品等前端篩選條件後端尚未提供。
 */
export function listProducts(params: HttpParams): ApiProductPage {
  const categoryCode = params.get('categoryCode');
  const keyword = params.get('q')?.trim();
  const page = numberParam(params, 'page') ?? 1;
  const pageSize = numberParam(params, 'pageSize') ?? 20;

  const matched = CATALOG.filter((record) => {
    if (categoryCode && record.cat !== categoryCode) return false;
    const haystack = record.name + record.brand + record.cat + record.material + record.source;
    return !keyword || haystack.includes(keyword);
  }).sort((a, b) => a.name.localeCompare(b.name));

  return {
    items: matched.slice((page - 1) * pageSize, page * pageSize).map(toApiProduct),
    page,
    pageSize,
    totalCount: matched.length,
    totalPages: Math.max(1, Math.ceil(matched.length / pageSize)),
  };
}

/** GET /products/{id}：商品詳情，回應為後端 DTO 格式（見 doc/apis.xml），查無商品時回應 404 */
export function getProduct(id: string): ApiProductDetail {
  return toApiProductDetail(findRecord(id));
}

export function listRelated(id: string, params: HttpParams) {
  const record = findRecord(id);
  const limit = numberParam(params, 'limit') ?? 5;
  const items = CATALOG.filter((other) => other.cat === record.cat && other.id !== record.id)
    .concat(CATALOG.filter((other) => other.cat !== record.cat))
    .slice(0, limit)
    .map(toProduct);
  return { items };
}

/** 假型錄的 Review → 後端「商品評論」DTO（見 doc/apis.xml），每件商品皆回傳同一組示意評論 */
function toApiReview(review: Review, productId: string): ApiProductReview {
  return {
    id: review.id,
    productId,
    userId: review.id,
    displayName: review.user,
    rating: review.stars,
    content: review.text,
    isVerifiedPurchase: true,
    createdAt: `${review.date}T00:00:00Z`,
    updatedAt: `${review.date}T00:00:00Z`,
  };
}

/**
 * GET /products/{id}/reviews：商品評論。回應為後端 DTO 格式（見 doc/apis.xml），只支援分頁，
 * 不支援依星等／照片篩選，篩選與統計由 CatalogApi 在前端計算。
 */
export function listReviews(id: string, params: HttpParams): ApiProductReviewsResponse {
  findRecord(id);
  const page = numberParam(params, 'page') ?? 1;
  const pageSize = numberParam(params, 'pageSize') ?? 10;
  const items = REVIEWS.map((review) => toApiReview(review, id));
  const averageRating = items.length
    ? Math.round((items.reduce((sum, review) => sum + review.rating, 0) / items.length) * 10) / 10
    : 0;

  return {
    summary: { averageRating, reviewCount: items.length },
    reviews: {
      items: items.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      totalCount: items.length,
      totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
    },
  };
}

/* ===============================
   首頁與行銷內容
   =============================== */

export function listHeroSlides() {
  return { slides: HERO_SLIDES };
}

export function getFlashSale(): FlashSale {
  return {
    endsAt: new Date(Date.now() + FLASH_SALE_REMAINING_MS).toISOString(),
    items: FLASH_SALE_ITEMS.map(({ productId, stockRatio }) => {
      const record = findRecord(productId);
      return { productId, name: record.name, price: dealPrice(record), originalPrice: record.price, stockRatio };
    }),
  };
}

export function listBrands() {
  return { brands: BRANDS };
}

/** 熱銷排行（示意資料沿用型錄順序作為名次，正式應依銷售統計排序） */
export function listRankings(params: HttpParams) {
  const cat = params.get('cat');
  const limit = numberParam(params, 'limit') ?? 10;
  const items = CATALOG.filter((record) => !cat || record.cat === cat)
    .slice(0, limit)
    .map(toProduct);
  return { items };
}

export function listRecommendations(params: HttpParams): Page<RecommendedProduct> {
  const ordered = [
    ...RECOMMENDATION_ORDER.map(findRecord),
    ...CATALOG.filter((record) => !RECOMMENDATION_ORDER.includes(record.id)),
  ];
  const items = ordered.map((record, i) => ({
    ...toProduct(record),
    reason: RECOMMENDATION_REASONS[i % RECOMMENDATION_REASONS.length],
  }));
  return paginate(items, params);
}

export function listClaimableCoupons() {
  return { coupons: CLAIMABLE_COUPONS };
}

/* ===============================
   搜尋
   =============================== */

export function listHotLinks() {
  return { links: HOT_SEARCH_LINKS };
}

export function listSuggestions(params: HttpParams) {
  const keyword = params.get('q')?.trim() ?? '';
  const suggestions = keyword
    ? SUGGESTION_SUFFIXES.map((suffix, i) => ({
        keyword: keyword + suffix,
        productCount: SUGGESTION_COUNT_BASE - i * SUGGESTION_COUNT_STEP,
      }))
    : [];
  return { suggestions };
}

/* ===============================
   購物車
   =============================== */

/** 購物車內的型錄紀錄與數量，依型錄順序排列 */
function cartLines() {
  return CATALOG.filter((record) => cartQuantities.has(record.id)).map((record) => ({
    record,
    qty: cartQuantities.get(record.id) ?? 0,
  }));
}

/** 購物車商品金額：折扣前小計與折扣後應付商品金額 */
function cartItemTotals(lines: ReturnType<typeof cartLines>) {
  return {
    subtotal: lines.reduce((sum, { record, qty }) => sum + record.price * qty, 0),
    itemsPayable: lines.reduce((sum, { record, qty }) => sum + dealPrice(record) * qty, 0),
  };
}

/** 購物車頁的免運判斷：應付商品金額為 0（購物車為空）視同已達門檻 */
function reachesFreeShipping(itemsPayable: number): boolean {
  return itemsPayable === 0 || itemsPayable >= FREE_SHIPPING_THRESHOLD;
}

function buildCart(): ShoppingCart {
  const lines = cartLines();
  const items = lines.map(({ record, qty }) => ({
    productId: record.id,
    brand: record.brand,
    category: record.cat,
    name: record.name,
    dimensions: record.dims,
    price: dealPrice(record),
    originalPrice: record.off > 0 ? record.price : null,
    qty,
    lineTotal: dealPrice(record) * qty,
  }));
  const addons = CATALOG.filter((record) => !cartQuantities.has(record.id))
    .slice(0, ADDON_LIMIT)
    .map(toProduct);

  // 購物車頁以預設配送方式（第一項）試算運費
  const { subtotal, itemsPayable } = cartItemTotals(lines);
  const freeShipping = reachesFreeShipping(itemsPayable);
  const shippingFee = freeShipping ? 0 : SHIPPING_OPTIONS[0].fee;
  const amounts = {
    subtotal,
    itemDiscount: subtotal - itemsPayable,
    shippingFee,
    payable: itemsPayable + shippingFee,
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
    freeShippingShortfall: freeShipping ? 0 : FREE_SHIPPING_THRESHOLD - itemsPayable,
  };
  return { items, addons, amounts };
}

function requireQty(qty: unknown): number {
  if (typeof qty !== 'number' || !Number.isInteger(qty) || qty <= 0) {
    throw new MockApiError(400, '數量必須為正整數');
  }
  return qty;
}

export function getCart(): ShoppingCart {
  return buildCart();
}

export function addCartItem(body: unknown): ShoppingCart {
  const { productId, qty } = body as { productId: string; qty: unknown };
  findRecord(productId);
  cartQuantities.set(productId, (cartQuantities.get(productId) ?? 0) + requireQty(qty));
  return buildCart();
}

export function updateCartItem(productId: string, body: unknown): ShoppingCart {
  if (!cartQuantities.has(productId)) throw new MockApiError(404, `購物車內沒有商品 ${productId}`);
  cartQuantities.set(productId, requireQty((body as { qty: unknown }).qty));
  return buildCart();
}

export function removeCartItem(productId: string): ShoppingCart {
  cartQuantities.delete(productId);
  return buildCart();
}

/* ===============================
   會員
   =============================== */

export function getMemberProfile() {
  return MEMBER;
}

export function listMemberCoupons() {
  return { coupons: MEMBER_COUPONS };
}

/* ===============================
   結帳與訂單
   =============================== */

export function getCheckoutOptions(): CheckoutOptions {
  return {
    shippingOptions: SHIPPING_OPTIONS,
    paymentOptions: PAYMENT_OPTIONS,
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
    pointEarnRate: POINT_EARN_RATE,
  };
}

/** 折價券在應付商品金額下的折抵結果；未達門檻則不生效 */
function applyCoupon(coupon: Coupon | null, payable: number) {
  if (!coupon || payable < coupon.min) return { discount: 0, freeShipping: false };
  if (coupon.kind === 'amount') return { discount: coupon.value, freeShipping: false };
  if (coupon.kind === 'percent') {
    return { discount: Math.min(coupon.cap ?? Infinity, Math.round(payable * coupon.value)), freeShipping: false };
  }
  return { discount: 0, freeShipping: true };
}

/** 依購物車、配送方式、折價券與點數規則計算訂單金額（試算與送出訂單共用） */
function quoteOrder(request: OrderQuoteRequest): OrderQuote {
  const shipping = SHIPPING_OPTIONS.find((option) => option.id === request.shippingOptionId);
  if (!shipping) throw new MockApiError(400, '無效的配送方式');
  const coupon = request.couponId === null ? null : MEMBER_COUPONS.find((item) => item.id === request.couponId);
  if (coupon === undefined) throw new MockApiError(400, '無效的折價券');

  const lines = cartLines();
  const { subtotal, itemsPayable } = cartItemTotals(lines);
  const cut = applyCoupon(coupon, itemsPayable);
  const shippingFee = cut.freeShipping || itemsPayable >= FREE_SHIPPING_THRESHOLD ? 0 : shipping.fee;
  const pointCap = Math.min(MEMBER.pointBalance, itemsPayable);
  const pointsUsed = Math.min(Math.max(0, Math.floor(request.usePoints || 0)), pointCap);
  const payable = Math.max(0, itemsPayable - cut.discount - pointsUsed + shippingFee);

  return {
    lines: lines.map(({ record, qty }) => ({
      productId: record.id,
      name: record.name,
      qty,
      lineTotal: dealPrice(record) * qty,
    })),
    shippingOptions: SHIPPING_OPTIONS.map((option) => ({
      ...option,
      fee: itemsPayable >= FREE_SHIPPING_THRESHOLD ? 0 : option.fee,
    })),
    usableCouponIds: MEMBER_COUPONS.filter((item) => itemsPayable >= item.min).map((item) => item.id),
    pointCap,
    subtotal,
    itemDiscount: subtotal - itemsPayable,
    shippingFee,
    couponDiscount: cut.discount,
    pointsUsed,
    payable,
    pointsEarned: Math.round(payable * POINT_EARN_RATE),
  };
}

/** 試算訂單金額：不成立訂單、不清空購物車 */
export function getOrderQuote(body: unknown): OrderQuote {
  return quoteOrder(body as OrderQuoteRequest);
}

/** 送出訂單：不採用前端顯示的金額，依購物車、折價券與點數規則重新計算，成立後清空購物車 */
export function createOrder(body: unknown): OrderResult {
  const order = body as OrderRequest;
  const { recipient } = order;
  if (![recipient?.name, recipient?.phone, recipient?.address].every((value) => value?.trim())) {
    throw new MockApiError(400, '收件人姓名、電話與地址為必填');
  }
  if (cartQuantities.size === 0) throw new MockApiError(400, '購物車是空的');
  if (!PAYMENT_OPTIONS.some((option) => option.id === order.paymentOptionId)) {
    throw new MockApiError(400, '無效的付款方式');
  }

  const quote = quoteOrder(order);
  cartQuantities.clear();
  return {
    orderId: `od-${Date.now()}`,
    subtotal: quote.subtotal,
    itemDiscount: quote.itemDiscount,
    shippingFee: quote.shippingFee,
    couponDiscount: quote.couponDiscount,
    pointsUsed: quote.pointsUsed,
    payable: quote.payable,
    pointsEarned: quote.pointsEarned,
  };
}

/* ===============================
   全站設定
   =============================== */

export function getSiteConfig() {
  return SITE_CONFIG;
}
