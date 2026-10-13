import { ProductCardBadgeVariant } from '../../component';
import { ProductViewData } from '../../shared/product-view';

/**
 * 首頁的頁面選項定義。
 * 各版位的內容皆由 API 取得（見 store/api），本檔案僅保留前端行為設定。
 */

/** 熱銷排行除「全站」外顯示的分頁數：取商品件數最多的器類 */
export const RANKING_TAB_COUNT = 4;

/** 附角標的商品卡片資料（熱銷排行的名次、為你推薦的推薦理由） */
export interface BadgedProductView extends ProductViewData {
  badge: string;
  badgeVariant: ProductCardBadgeVariant;
  /** 器類色調名稱（為你推薦的器類角標用） */
  badgeTone?: string;
}

/** 熱銷排行與為你推薦各向 API 取得的商品數量 */
export const HOME_PRODUCT_COUNT = 20;
/** 熱銷排行與為你推薦固定顯示的行數；欄數隨視窗寬度變化，超出這個行數的商品不顯示 */
export const HOME_PRODUCT_ROWS = 2;
