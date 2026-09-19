import { Component, computed, input, output } from '@angular/core';
import { SectionHead, PillGroup, PillOption } from '../../../component';
import { Review } from '../../../api/api.models';
import { formatNumber } from '../../../shared/format';
import { REVIEW_FILTERS } from '../product-info.data';

/** 星等上限，用於把星等換算成實心／空心星號字串 */
const MAX_STARS = 5;

/** 供模板逐則顯示的評價資料，由 Review 換算而成 */
interface ReviewCardData {
  /** @for 追蹤用的鍵值 */
  key: string;
  /** 星等字串，例如 ★★★★☆ */
  stars: string;
  user: string;
  /** 評價日期，例如 2026.08.29 */
  date: string;
  text: string;
  hasPhoto: boolean;
}

/**
 * 商品頁「評價」區塊：評分摘要、篩選按鈕與評價清單。
 * 篩選由評價 API 在後端執行，因此目前選取的條件、各條件的則數與篩選後的評價皆由頁面傳入，
 * 本元件只負責顯示與回報使用者選取的篩選條件。
 */
@Component({
  selector: 'app-product-reviews',
  imports: [SectionHead, PillGroup],
  templateUrl: './product-reviews.html',
  styleUrls: [
    './product-reviews.scss',
  ],
})
export class ProductReviews {
  /** 商品評分（顯示於標題列摘要） */
  rating = input(0);
  /** 商品評論數（顯示於標題列摘要） */
  reviewCount = input(0);
  /** 符合目前篩選條件的評價 */
  reviews = input<Review[]>([]);
  /** 各篩選條件的則數（依 REVIEW_FILTERS 順序） */
  filterCounts = input<number[]>([]);
  /** 目前選取的篩選條件索引 */
  filterIndex = input(0);

  /** 選取篩選條件時觸發，帶出條件索引 */
  filterChange = output<number>();

  /** 以下為區塊的固定版面文字 */
  protected readonly title = '評價';
  protected readonly tag = 'REVIEWS';
  protected readonly photoTagLabel = '附照片';
  protected readonly emptyText = '此篩選條件下尚無評價。';

  /** 評分顯示字串，固定一位小數 */
  protected getRating = computed(() => this.rating().toFixed(1));
  /** 評論數顯示字串（千分位） */
  protected getReviewCount = computed(() => `${formatNumber(this.reviewCount())} 則評論`);

  /** 篩選按鈕選項，括號內為各條件的則數，選取狀態由 filterIndex 推導 */
  protected filterOptions = computed<PillOption[]>(() =>
    REVIEW_FILTERS.map((filter, i) => ({
      label: `${filter.label}（${this.filterCounts()[i] ?? 0}）`,
      active: i === this.filterIndex(),
      // 該條件沒有評價時停用；商品完全沒有評價時全部停用
      disabled: this.reviewCount() === 0 || (this.filterCounts()[i] ?? 0) === 0,
    })),
  );

  /** 評價顯示資料 */
  protected shown = computed<ReviewCardData[]>(() =>
    this.reviews().map((review) => ({
      key: review.id,
      stars: '★'.repeat(review.stars) + '☆'.repeat(MAX_STARS - review.stars),
      user: review.user,
      date: review.date.replaceAll('-', '.'),
      text: review.text,
      hasPhoto: review.hasPhoto,
    })),
  );
}
