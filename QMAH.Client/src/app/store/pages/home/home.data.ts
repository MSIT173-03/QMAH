import { ProductCardBadgeVariant } from '../../component';
import { ProductViewData } from '../../shared/product-view';

/**
 * 首頁的頁面選項定義。
 * 各版位的內容皆由 API 取得（見 store/api），本檔案僅保留前端行為設定。
 */

/** 附角標的商品卡片資料（熱銷排行的名次、為你推薦的推薦理由） */
export interface BadgedProductView extends ProductViewData {
  badge: string;
  badgeVariant: ProductCardBadgeVariant;
}
