import { ProductOrder } from '../../api/api.models';

/**
 * 商品列表頁的頁面選項定義（排序、價格區間、顯示模式）。
 * 商品與器類清單由 API 取得（見 store/api）；排序與價格區間在此只定義
 * 選項文字與對應的查詢參數，實際的篩選與排序由後端執行。
 */

/* ===============================
   頁面選項定義（前端行為設定）
   =============================== */

/** 價格區間篩選選項，對應商品清單 API 的 priceMin／priceMax 參數 */
export interface PriceBand {
  label: string;
  /** 折扣後售價下限（含），未指定代表不設下限 */
  min?: number;
  /** 折扣後售價上限（不含），未指定代表不設上限 */
  max?: number;
}

/** 價格區間篩選選項清單，索引 0 為不篩選 */
export const PRICE_BANDS: PriceBand[] = [
  { label: '全部價格' },
  { label: '$0 – $1,000', max: 1000 },
  { label: '$1,000 – $2,500', min: 1000, max: 2500 },
  { label: '$2,500 以上', min: 2500 },
];

/** 排序選項 */
export interface OrderOption {
  label: string;
  /** 對應商品清單 API 的 order 參數 */
  order: ProductOrder;
}

/** 排序選項清單，索引 0 為預設排序 */
export const ORDER_OPTIONS: OrderOption[] = [
  { label: '推薦排序', order: 0 },
  { label: '熱銷排行', order: 1 },
  { label: '上架：舊到新', order: 2 },
  { label: '上架：新到舊', order: 3 },
  { label: '價格低→高', order: 4 },
  { label: '價格高→低', order: 5 },
];

/** 顯示模式（卡片格狀／橫列清單） */
export type DisplayModeKey = 'grid' | 'list';

/** 顯示模式切換選項 */
export interface DisplayMode {
  key: DisplayModeKey;
  label: string;
  icon: 'layout-grid' | 'list';
  /** 滑鼠停留提示文字 */
  title: string;
}

/** 顯示模式切換選項清單 */
export const DISPLAY_MODES: DisplayMode[] = [
  { key: 'grid', label: '卡片', icon: 'layout-grid', title: '卡片顯示' },
  { key: 'list', label: '列表', icon: 'list', title: '列表顯示' },
];

/** 由網址 view 參數對應的頁面標題文字 */
export const VIEW_HEADINGS: Record<string, string> = {
  deal: '限時特賣',
  new: '新品上架',
  exhibit: '特展聯名',
};

/**
 * 由網址 view 參數對應的預設排序方式（未列出者使用 ORDER_OPTIONS 第一項）；
 * 特展聯名原以評價最多排序，因商品清單 API 的 order 參數未提供依評價排序，改以熱銷排行代替。
 */
export const VIEW_DEFAULT_ORDER: Record<string, ProductOrder> = {
  new: 3,
  exhibit: 1,
};

/** 不限器類時的標示文字，同時用於分類清單第一項與未指定條件時的頁面標題 */
export const ALL_PRODUCTS_LABEL = '全部商品';
/** 年代篩選的「不限年代」項目文字 */
export const ALL_ERAS_LABEL = '全部年代';
