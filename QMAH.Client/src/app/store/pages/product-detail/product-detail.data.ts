import { ReviewPage, ReviewQuery } from '../../api/api.models';

/**
 * 商品頁的頁面選項定義與商品顯示資料換算。
 * 商品、評價、同類推薦與商品說明文案皆由 API 取得（見 store/api）；
 * 評價篩選在此只定義按鈕文字、對應的篩選參數與則數取法，實際篩選由 toReviewPage 在前端計算。
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
  /** 對應的評價篩選參數 */
  query: ReviewQuery;
  /** 由評價統計資料取得符合此條件的則數 */
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
];
