import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { SectionHead, PillGroup, PillOption } from '../../../component';
import { Review } from '../../../api/api.models';
import { ReviewDraft } from '../../../api/review.api';
import { formatDateTime } from '../../../shared/format';
import { formatRating, formatReviews } from '../../../shared/product-view';
import { REVIEW_FILTERS } from '../product-info.data';

/** 星等上限，用於把星等換算成實心／空心星號字串 */
const MAX_STARS = 5;
/** 後端對評價內容的長度上限 */
const MAX_CONTENT_LENGTH = 1000;

/** 星等字串，例如 ★★★★☆ */
function toStars(stars: number): string {
  return '★'.repeat(stars) + '☆'.repeat(MAX_STARS - stars);
}

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
  /** 編輯時間，例如 2026.08.30 14:05；從未編輯過時為 null */
  edited: string | null;
}

/** 把 Review 換算成顯示資料 */
function toCardData(review: Review): ReviewCardData {
  return {
    key: review.id,
    stars: toStars(review.stars),
    user: review.user,
    date: review.date.replaceAll('-', '.'),
    text: review.text,
    edited: review.editedAt ? formatDateTime(review.editedAt) : null,
  };
}

/**
 * 商品頁「評價」區塊：評分摘要、（買過這件商品時的）自己的評價、篩選按鈕與評價清單。
 * 篩選由頁面計算，因此目前選取的條件、各條件的則數與篩選後的評價皆由頁面傳入，
 * 本元件只負責顯示與回報使用者選取的篩選條件。
 *
 * 自己的評價（canReview 為 true 時顯示在標題下方、篩選按鈕上方）：
 * - 還沒有評價：評分與輸入框，按「送出」後由頁面送到後端；
 * - 已有評價：顯示為不可修改的文字（附編輯時間），按「編輯」才能改內容並再次送出。
 */
@Component({
  selector: 'app-product-reviews',
  imports: [SectionHead, PillGroup],
  templateUrl: './product-reviews.html',
  styleUrl: './product-reviews.scss',
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

  /** 目前會員是否買過這件商品（才能留下評價） */
  canReview = input(false);
  /** 目前會員自己的評價：undefined 代表尚在載入，null 代表還沒有評價 */
  myReview = input<Review | null | undefined>(undefined);
  /** 評價正在送出 */
  saving = input(false);
  /** 最近一次送出失敗的說明 */
  saveError = input<string | null>(null);

  /** 選取篩選條件時觸發，帶出條件索引 */
  filterChange = output<number>();
  /** 按下「送出」時觸發，帶出星等與內容 */
  reviewSave = output<ReviewDraft>();

  /** 以下為區塊的固定版面文字 */
  protected readonly title = '評價';
  protected readonly tag = 'REVIEWS';
  protected readonly emptyText = '此篩選條件下尚無評價。';
  protected readonly myReviewLabel = '我的評價';
  protected readonly ratingLabel = '評分';
  protected readonly contentLabel = '評價內容';
  protected readonly contentPlaceholder = '分享你對這件商品的心得';
  protected readonly submitLabel = '送出';
  protected readonly submittingLabel = '送出中…';
  protected readonly editLabel = '編輯';
  protected readonly cancelLabel = '取消';
  protected readonly editedPrefix = '編輯於';
  protected readonly maxContentLength = MAX_CONTENT_LENGTH;
  /** 可選的星等 */
  protected readonly starValues = [1, 2, 3, 4, 5];

  /** 是否正在編輯已送出的評價 */
  protected readonly editing = signal(false);
  /** 輸入中的星等（0 代表尚未選擇） */
  protected readonly draftRating = signal(0);
  /** 輸入中的內容 */
  protected readonly draftContent = signal('');

  /** 評分顯示字串，固定一位小數 */
  protected getRating = computed(() => formatRating(this.rating()));
  /** 評論數顯示字串（千分位） */
  protected getReviewCount = computed(() => formatReviews(this.reviewCount()));

  /** 顯示輸入表單：買過、已確認沒有評價（或正在編輯） */
  protected showForm = computed(() => this.canReview() && this.myReview() !== undefined && (this.myReview() === null || this.editing()));
  /** 顯示已送出的評價（不可修改的文字） */
  protected mine = computed<ReviewCardData | null>(() => {
    const review = this.myReview();
    return this.canReview() && review && !this.editing() ? toCardData(review) : null;
  });
  /** 評分與內容是否都已填寫，且沒有正在送出 */
  protected canSubmit = computed(
    () => this.draftRating() >= 1 && this.draftContent().trim().length > 0 && !this.saving(),
  );

  /** 篩選按鈕選項，括號內為各條件的則數；選取狀態由 filterIndex 推導，該條件則數為 0 時停用按鈕 */
  protected filterOptions = computed<PillOption[]>(() =>
    REVIEW_FILTERS.map((filter, i) => {
      const count = this.filterCounts()[i] ?? 0;
      return {
        label: `${filter.label}（${count}）`,
        active: i === this.filterIndex(),
        disabled: count === 0,
      };
    }),
  );

  /** 評價顯示資料 */
  protected shown = computed<ReviewCardData[]>(() => this.reviews().map(toCardData));

  constructor() {
    // 自己的評價變動（載入完成、儲存成功、換商品）時離開編輯狀態；還沒有評價時清空輸入。
    effect(() => {
      const review = this.myReview();
      untracked(() => {
        this.editing.set(false);
        if (!review) {
          this.draftRating.set(0);
          this.draftContent.set('');
        }
      });
    });
  }

  /** 按「編輯」：以已送出的內容開始編輯 */
  protected startEdit(): void {
    const review = this.myReview();
    if (!review) return;
    this.draftRating.set(review.stars);
    this.draftContent.set(review.text);
    this.editing.set(true);
  }

  /** 按「取消」：放棄這次編輯 */
  protected cancelEdit(): void {
    this.editing.set(false);
  }

  protected onContentInput(event: Event): void {
    this.draftContent.set((event.target as HTMLTextAreaElement).value);
  }

  /** 按「送出」 */
  protected submit(): void {
    if (!this.canSubmit()) return;
    this.reviewSave.emit({ rating: this.draftRating(), content: this.draftContent().trim() });
  }
}
