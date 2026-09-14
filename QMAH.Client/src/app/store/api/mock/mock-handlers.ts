import { HttpParams } from '@angular/common/http';
import {
  CheckoutOptions,
  Coupon,
  FlashSale,
  OrderRequest,
  OrderResult,
  Page,
  Product,
  ProductDetail,
  ProductSort,
  RecommendedProduct,
  ReviewPage,
  ShoppingCart,
} from '../api.models';
import {
  ADDON_LIMIT,
  BRANDS,
  CATALOG,
  CATEGORIES,
  CLAIMABLE_COUPONS,
  CONDITION_MEASURED,
  CONDITION_PENDING,
  CatalogRecord,
  DESCRIPTION_SUFFIX,
  DIMS_PENDING,
  FLASH_SALE_ITEMS,
  FLASH_SALE_REMAINING_MS,
  FREE_SHIPPING_THRESHOLD,
  GALLERY_VIEWS,
  HERO_SLIDES,
  HOT_SEARCH_LINKS,
  MEMBER,
  MEMBER_COUPONS,
  PAYMENT_OPTIONS,
  POINT_EARN_RATE,
  RECOMMENDATION_ORDER,
  RECOMMENDATION_REASONS,
  REVIEWS,
  SHIPPING_NOTE,
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
  };
}

function toProductDetail(record: CatalogRecord): ProductDetail {
  return {
    ...toProduct(record),
    material: record.material,
    description: record.source + DESCRIPTION_SUFFIX,
    condition: record.dims === DIMS_PENDING ? CONDITION_PENDING : CONDITION_MEASURED,
    shippingNote: SHIPPING_NOTE,
    images: GALLERY_VIEWS.map((view) => ({ view, url: null })),
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

const PRODUCT_SORTERS: Record<ProductSort, (a: CatalogRecord, b: CatalogRecord) => number> = {
  recommend: (a, b) => b.rating - a.rating,
  'price-asc': (a, b) => dealPrice(a) - dealPrice(b),
  'price-desc': (a, b) => dealPrice(b) - dealPrice(a),
  reviews: (a, b) => b.reviews - a.reviews,
  new: (a, b) => b.listedAt.localeCompare(a.listedAt),
};

export function listProducts(params: HttpParams): Page<Product> {
  const cat = params.get('cat');
  const keyword = params.get('q')?.trim();
  const priceMin = numberParam(params, 'priceMin');
  const priceMax = numberParam(params, 'priceMax');
  const dealOnly = params.get('dealOnly') === 'true';
  const sort = params.get('sort');
  if (sort !== null && !(sort in PRODUCT_SORTERS)) throw new MockApiError(400, `不支援的排序方式 ${sort}`);

  const matched = CATALOG.filter((record) => {
    const price = dealPrice(record);
    if (cat && record.cat !== cat) return false;
    if (dealOnly && record.off <= 0) return false;
    if (priceMin !== undefined && price < priceMin) return false;
    if (priceMax !== undefined && price >= priceMax) return false;
    const haystack = record.name + record.brand + record.cat + record.material + record.source;
    return !keyword || haystack.includes(keyword);
  });
  if (sort !== null) matched.sort(PRODUCT_SORTERS[sort as ProductSort]);
  return paginate(matched.map(toProduct), params);
}

export function getProduct(id: string): ProductDetail {
  return toProductDetail(findRecord(id));
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

export function listReviews(id: string, params: HttpParams): ReviewPage {
  findRecord(id);
  const minStars = numberParam(params, 'minStars') ?? 1;
  const maxStars = numberParam(params, 'maxStars') ?? 5;
  const photoOnly = params.get('hasPhoto') === 'true';
  const matched = REVIEWS.filter(
    (review) => review.stars >= minStars && review.stars <= maxStars && (!photoOnly || review.hasPhoto),
  );

  const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const review of REVIEWS) ratingBreakdown[review.stars as keyof typeof ratingBreakdown] += 1;

  return {
    ...paginate(matched, params),
    ratingBreakdown,
    photoCount: REVIEWS.filter((review) => review.hasPhoto).length,
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

function buildCart(): ShoppingCart {
  const items = CATALOG.filter((record) => cartQuantities.has(record.id)).map((record) => ({
    productId: record.id,
    brand: record.brand,
    category: record.cat,
    name: record.name,
    dimensions: record.dims,
    price: dealPrice(record),
    originalPrice: record.off > 0 ? record.price : null,
    qty: cartQuantities.get(record.id) ?? 0,
  }));
  const addons = CATALOG.filter((record) => !cartQuantities.has(record.id))
    .slice(0, ADDON_LIMIT)
    .map(toProduct);
  return { items, addons };
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

/** 送出訂單：不採用前端試算的金額，依購物車、折價券與點數規則重新計算，成立後清空購物車 */
export function createOrder(body: unknown): OrderResult {
  const order = body as OrderRequest;
  const { recipient } = order;
  if (![recipient?.name, recipient?.phone, recipient?.address].every((value) => value?.trim())) {
    throw new MockApiError(400, '收件人姓名、電話與地址為必填');
  }
  const lines = CATALOG.filter((record) => cartQuantities.has(record.id));
  if (lines.length === 0) throw new MockApiError(400, '購物車是空的');

  const shipping = SHIPPING_OPTIONS.find((option) => option.id === order.shippingOptionId);
  if (!shipping) throw new MockApiError(400, '無效的配送方式');
  if (!PAYMENT_OPTIONS.some((option) => option.id === order.paymentOptionId)) {
    throw new MockApiError(400, '無效的付款方式');
  }
  const coupon = order.couponId === null ? null : MEMBER_COUPONS.find((item) => item.id === order.couponId);
  if (coupon === undefined) throw new MockApiError(400, '無效的折價券');

  const qtyOf = (record: CatalogRecord) => cartQuantities.get(record.id) ?? 0;
  const subtotal = lines.reduce((sum, record) => sum + record.price * qtyOf(record), 0);
  const itemsPayable = lines.reduce((sum, record) => sum + dealPrice(record) * qtyOf(record), 0);
  const cut = applyCoupon(coupon, itemsPayable);
  const shippingFee = cut.freeShipping || itemsPayable >= FREE_SHIPPING_THRESHOLD ? 0 : shipping.fee;
  const pointsUsed = Math.min(Math.max(0, Math.floor(order.usePoints || 0)), MEMBER.pointBalance, itemsPayable);
  const payable = Math.max(0, itemsPayable - cut.discount - pointsUsed + shippingFee);

  cartQuantities.clear();
  return {
    orderId: `od-${Date.now()}`,
    subtotal,
    itemDiscount: subtotal - itemsPayable,
    shippingFee,
    couponDiscount: cut.discount,
    pointsUsed,
    payable,
    pointsEarned: Math.round(payable * POINT_EARN_RATE),
  };
}

/* ===============================
   全站設定
   =============================== */

export function getSiteConfig() {
  return SITE_CONFIG;
}
