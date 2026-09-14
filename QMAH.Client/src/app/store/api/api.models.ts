/**
 * 後端 API 的請求參數與回應資料格式，規格說明見 doc/api-requirements.html。
 */

/* ===============================
   共用
   =============================== */

/** 分頁查詢參數，未指定時回傳全部 */
export interface PageQuery {
  /** 頁碼，從 1 開始 */
  page?: number;
  pageSize?: number;
}

/** 分頁回應 */
export interface Page<T> {
  items: T[];
  /** 符合條件的總筆數 */
  total: number;
  page: number;
  pageSize: number;
}

/* ===============================
   商品型錄與詳情
   =============================== */

/** 器類 */
export interface Category {
  id: string;
  name: string;
  /** 此器類的商品件數 */
  productCount: number;
}

/** 商品清單項目 */
export interface Product {
  id: string;
  name: string;
  brand: string;
  /** 器類名稱 */
  category: string;
  /** 定價（未折扣） */
  price: number;
  /** 折扣後售價 */
  dealPrice: number;
  /** 折扣比例，0 代表無折扣 */
  discountRate: number;
  rating: number;
  reviewCount: number;
  soldCount: number;
  /** 紋樣／器型出處說明 */
  source: string;
  /** 尺寸／規格說明 */
  dimensions: string;
  /** 上架日期（YYYY-MM-DD） */
  listedAt: string;
}

/** 商品圖片 */
export interface ProductImage {
  /** 視角名稱（正面、細節…），順序即縮圖列的顯示順序 */
  view: string;
  /** 圖片網址，為 null 時前端顯示佔位文字 */
  url: string | null;
}

/** 商品詳情 */
export interface ProductDetail extends Product {
  /** 材質與工法說明 */
  material: string;
  /** 商品說明段落 */
  description: string;
  /** 商品狀態說明 */
  condition: string;
  /** 出貨說明 */
  shippingNote: string;
  images: ProductImage[];
}

/** 商品清單排序方式 */
export type ProductSort = 'recommend' | 'price-asc' | 'price-desc' | 'reviews' | 'new';

/** 商品清單查詢參數，未指定的條件不篩選；未指定 sort 時依型錄預設順序 */
export interface ProductQuery extends PageQuery {
  /** 器類名稱 */
  cat?: string;
  /** 關鍵字，比對商品名稱、品牌、器類、材質與出處說明 */
  q?: string;
  sort?: ProductSort;
  /** 折扣後售價下限（含） */
  priceMin?: number;
  /** 折扣後售價上限（不含） */
  priceMax?: number;
  /** 只列出折扣商品 */
  dealOnly?: boolean;
}

/** 單則商品評價 */
export interface Review {
  id: string;
  /** 星等（1–5） */
  stars: number;
  /** 評價者代稱 */
  user: string;
  /** 評價日期（YYYY-MM-DD） */
  date: string;
  hasPhoto: boolean;
  text: string;
}

/** 商品評價查詢參數 */
export interface ReviewQuery extends PageQuery {
  minStars?: number;
  maxStars?: number;
  /** 只列出附照片的評價 */
  hasPhoto?: boolean;
}

/** 商品評價回應；total 為篩選後的則數 */
export interface ReviewPage extends Page<Review> {
  /** 各星等則數，不受篩選條件影響 */
  ratingBreakdown: Record<1 | 2 | 3 | 4 | 5, number>;
  /** 附照片的則數，不受篩選條件影響 */
  photoCount: number;
}

/* ===============================
   首頁與行銷內容
   =============================== */

/** 主視覺輪播投影片 */
export interface HeroSlide {
  /** 主視覺圖片的佔位說明文字 */
  slot: string;
  kicker: string;
  title: string;
  desc: string;
}

/** 限時特賣品項 */
export interface FlashSaleItem {
  productId: string;
  name: string;
  /** 特賣價 */
  price: number;
  /** 原價 */
  originalPrice: number;
  /** 剩餘庫存比例（0–1） */
  stockRatio: number;
}

/** 限時特賣 */
export interface FlashSale {
  /** 特賣結束時間（ISO 8601） */
  endsAt: string;
  items: FlashSaleItem[];
}

/** 品牌館品牌 */
export interface Brand {
  en: string;
  zh: string;
  /** 品牌優惠說明 */
  deal: string;
}

/** 熱銷排行查詢參數 */
export interface RankingQuery {
  /** 器類名稱，未指定時為全站排行 */
  cat?: string;
  limit?: number;
}

/** 推薦商品 */
export interface RecommendedProduct extends Product {
  /** 推薦理由，顯示為卡片角標 */
  reason: string;
}

/* ===============================
   搜尋
   =============================== */

/** 熱門搜尋捷徑 */
export interface HotSearchLink {
  label: string;
  href: string;
}

/** 搜尋建議關鍵字 */
export interface KeywordSuggestion {
  keyword: string;
  /** 符合此關鍵字的商品件數 */
  productCount: number;
}

/* ===============================
   購物車
   =============================== */

/** 購物車品項 */
export interface CartItem {
  productId: string;
  brand: string;
  /** 器類名稱 */
  category: string;
  name: string;
  /** 尺寸／規格說明 */
  dimensions: string;
  /** 折扣後單價 */
  price: number;
  /** 折扣前原價，無折扣時為 null */
  originalPrice: number | null;
  qty: number;
}

/** 購物車內容 */
export interface ShoppingCart {
  /** 購物車品項，依型錄順序排列 */
  items: CartItem[];
  /** 「再加購」推薦商品，不含購物車內已有的商品 */
  addons: Product[];
}

/* ===============================
   會員
   =============================== */

/** 收件資訊 */
export interface Recipient {
  name: string;
  phone: string;
  email: string;
  /** 發票統編 */
  taxId: string;
  address: string;
  /** 給客服的備註 */
  note: string;
}

/** 會員資料，收件欄位供結帳頁「帶入個人資料」使用 */
export interface MemberProfile extends Recipient {
  /** 持有的購物點數 */
  pointBalance: number;
}

/** 折價券折抵方式：amount 折抵固定金額；percent 依比例折抵並以 cap 為上限；freeship 免除運費 */
export type CouponKind = 'amount' | 'percent' | 'freeship';

/** 折價券（頂部公告列、首頁側欄與結帳頁共用同一模型） */
export interface Coupon {
  id: string;
  /** 折抵幅度標示（例如「$100」「9 折」「免運」） */
  off: string;
  title: string;
  /** 使用條件說明文字 */
  cond: string;
  /** 可使用的最低應付金額門檻 */
  min: number;
  kind: CouponKind;
  /** amount：折抵金額；percent：折抵比例；freeship：不使用 */
  value: number;
  /** percent 的折抵金額上限，無上限時為 null */
  cap: number | null;
  /** 到期日（YYYY-MM-DD），無期限時為 null */
  due: string | null;
}

/* ===============================
   結帳與訂單
   =============================== */

/** 配送方式 */
export interface ShippingOption {
  id: string;
  name: string;
  /** 未達免運門檻時的運費，0 代表一律免運 */
  fee: number;
}

/** 付款方式 */
export interface PaymentOption {
  id: string;
  name: string;
}

/** 結帳選項與規則 */
export interface CheckoutOptions {
  /** 配送方式，第一項為預設（購物車頁以其運費試算） */
  shippingOptions: ShippingOption[];
  paymentOptions: PaymentOption[];
  /** 滿額免運門檻 */
  freeShippingThreshold: number;
  /** 訂單完成後回饋的點數比例（以應付總額計算） */
  pointEarnRate: number;
}

/** 送出訂單的請求內容；訂單商品取目前登入者的購物車 */
export interface OrderRequest {
  recipient: Recipient;
  shippingOptionId: string;
  paymentOptionId: string;
  /** 選用的折價券，未選用時為 null */
  couponId: string | null;
  /** 欲折抵的點數 */
  usePoints: number;
}

/** 訂單結果；金額皆由後端重新計算，為最終依據 */
export interface OrderResult {
  orderId: string;
  /** 商品小計（折扣前） */
  subtotal: number;
  /** 商品折扣 */
  itemDiscount: number;
  shippingFee: number;
  couponDiscount: number;
  pointsUsed: number;
  /** 應付總額 */
  payable: number;
  pointsEarned: number;
}

/* ===============================
   全站設定
   =============================== */

/** 連結 */
export interface SiteLink {
  label: string;
  href: string;
}

/** 頁尾連結欄位 */
export interface SiteLinkColumn {
  title: string;
  links: SiteLink[];
}

/** 商品政策條列（保養、退換、鑑定） */
export interface ProductPolicy {
  label: string;
  text: string;
}

/** 全站共通、低頻更新的文案與設定 */
export interface SiteConfig {
  /** 頂部公告列的公告文字 */
  promoAnnouncements: string[];
  footerColumns: SiteLinkColumn[];
  productPolicies: ProductPolicy[];
  /** 商品尺寸量測說明 */
  sizeNote: string;
}
