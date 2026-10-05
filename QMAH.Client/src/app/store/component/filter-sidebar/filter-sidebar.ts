import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Panel } from '../panel/panel';
import { CategoryList, CategoryListItem } from '../category-list/category-list';
import { PillGroup, PillOption } from '../pill-group/pill-group';
import { QmahIconComponent } from '../../../shared/components/qmah-icon/qmah-icon';

/** 篩選側欄的可收合面板；同時只能展開一個 */
type FilterSection = 'category' | 'era' | 'price' | 'filter';

/** 頁首高度：側欄比視窗矮時，捲動時固定在頁首下方 */
const HEADER_OFFSET = 92;
/** 側欄比視窗高時，捲到側欄底端後固定在離視窗底端這個距離的位置 */
const BOTTOM_GAP = 16;

/** 面板順序與標題文字（固定版面文字） */
const FILTER_PANELS: readonly { section: FilterSection; label: string }[] = [
  { section: 'category', label: 'CATEGORY' },
  { section: 'era', label: 'ERA' },
  { section: 'price', label: 'PRICE' },
  { section: 'filter', label: 'FILTER' },
];

/**
 * 商品列表頁篩選側欄：分類、年代、價格區間與折扣篩選四個可收合面板，同時只能展開一個。
 * 面板標題與按鈕文案屬於固定版面文字，直接寫在元件內；
 * 各篩選項目與目前選取狀態則由外部傳入，選取結果以事件回報。
 */
@Component({
  selector: 'app-filter-sidebar',
  imports: [Panel, CategoryList, PillGroup, QmahIconComponent],
  templateUrl: './filter-sidebar.html',
  styleUrl: './filter-sidebar.scss',
})
export class FilterSidebar {
  /** 分類篩選項目（含件數與是否選取） */
  categories = input<CategoryListItem[]>([]);
  /** 年代篩選項目（含件數與是否選取） */
  eras = input<CategoryListItem[]>([]);
  /** 價格區間篩選項目文字，順序即顯示順序 */
  bands = input<string[]>([]);
  /** 目前選取的價格區間索引 */
  activeBand = input(0);
  /** 是否只顯示折扣商品 */
  dealOnly = input(false);

  /** 顯示中的面板；沒有年代資料時不顯示空的年代面板 */
  protected panels = computed(() =>
    FILTER_PANELS.filter((panel) => panel.section !== 'era' || this.eras().length > 0),
  );
  /** 折扣篩選按鈕文字 */
  protected readonly dealLabel = '只看折扣商品';
  /** 清除篩選按鈕文字 */
  protected readonly resetLabel = '清除所有篩選';

  /** 價格區間選項，選取狀態由 activeBand 於元件內推導 */
  protected bandOptions = computed<PillOption[]>(() =>
    this.bands().map((label, i) => ({ label, active: i === this.activeBand() })),
  );
  /** 折扣篩選選項，僅一項；選取狀態由 dealOnly 於元件內推導 */
  protected dealOptions = computed<PillOption[]>(() => [{ label: this.dealLabel, active: this.dealOnly() }]);

  /** 目前展開的面板；預設展開器類篩選，同時只能展開一個，再次點擊已展開的面板會收合 */
  protected expandedSection = signal<FilterSection | null>('category');
  /** 面板是否展開 */
  protected isOpen(section: FilterSection): boolean {
    return this.expandedSection() === section;
  }
  /** 切換面板收合狀態：點擊已展開的面板收合它，點擊其他面板則換成展開該面板 */
  protected toggleSection(section: FilterSection): void {
    this.expandedSection.update((current) => (current === section ? null : section));
  }

  private readonly aside = viewChild.required<ElementRef<HTMLElement>>('aside');
  /**
   * 側欄 sticky 的 top。側欄比視窗矮時是頁首高度，固定在頁首下方；
   * 側欄比視窗高時會變成負值，讓使用者往下捲時先把側欄捲完（看到最後一個選項），
   * 側欄底端到達視窗底端後才固定住，由商品卡片接著往下捲。
   * 側欄高度會隨面板展開／收合與視窗大小改變，所以要持續重算，無法單靠 CSS。
   */
  protected readonly stickyTop = signal(HEADER_OFFSET);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const element = this.aside().nativeElement;
      const update = () =>
        this.stickyTop.set(Math.min(HEADER_OFFSET, window.innerHeight - element.offsetHeight - BOTTOM_GAP));
      update();

      const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
      observer?.observe(element);
      window.addEventListener('resize', update);
      destroyRef.onDestroy(() => {
        observer?.disconnect();
        window.removeEventListener('resize', update);
      });
    });
  }

  /** 點擊某個分類時觸發，帶出該分類在 categories 中的索引值 */
  categoryPick = output<number>();
  /** 點擊某個年代時觸發，帶出該年代在 eras 中的索引值 */
  eraPick = output<number>();
  /** 點擊某個價格區間時觸發，帶出該區間在 bands 中的索引值 */
  bandPick = output<number>();
  /** 點擊折扣篩選按鈕時觸發（切換開關） */
  dealToggle = output<void>();
  /** 點擊「清除所有篩選」時觸發 */
  reset = output<void>();
}
