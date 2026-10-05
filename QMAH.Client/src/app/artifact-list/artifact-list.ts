// artifact-list.ts
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  NgZone,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, of, switchMap } from 'rxjs';
import { CatalogService } from '../services/catalog-service';
import { CatalogModel, CatalogDetailModel, EraModel } from '../models/catalog-model';
import { ArtifactUnlockRecord, CardEntry, CompendiumSkin, CompendiumCardSummary } from '../models/artifact-unlock-model';
import { KeyService } from '../services/key-service';
import { KeyFilter, KeyModel } from '../models/key-model';
import { keyAssetPath } from '../shared/key-assets';
import { SocialApiService } from '../core/services/social-api';
import { ArtifactDiscussionDialog } from './artifact-discussion-dialog/artifact-discussion-dialog';
import { KeyList } from '../key-list/key-list';

/** 依年代分組後的結構；一鍵解鎖用它決定「圖鑑由上至下」的順序 */
interface EraGroup {
  eraName: string;
  items: CompendiumCardSummary[];
}

/** 書頁上的一個分區：全部／年代頁籤依年代分區，分類頁籤依分類分區 */
export interface CatalogGroup {
  /** 展開狀態的 key，例如 era:唐、category:玉器；全部與年代頁籤共用年代的展開狀態 */
  key: string;
  label: string;
  items: CompendiumCardSummary[];
}

/**
 * 書頁內容以「行」為單位排版：分區標題一行、卡片每 cols 張一行。
 * divider：分區跨到右頁時不重複標題，只留一條與標題同高的分隔線，左右兩頁的卡片列才會對齊。
 */
export type CatalogLine =
  | { kind: 'header'; key: string; group: CatalogGroup; continued: boolean }
  | { kind: 'divider'; key: string; group: CatalogGroup }
  | { kind: 'row'; key: string; group: CatalogGroup; items: CompendiumCardSummary[] };

export interface CatalogPage {
  lines: CatalogLine[];
}

/** 由實際書頁大小算出的卡片尺寸；TS 跟 CSS 用同一組數字，分頁才會剛好放滿 */
export interface CatalogLayout {
  cols: number;
  cardW: number;
  cardH: number;
  rowH: number;
  bodyH: number;
}

export type BookState = 'closed' | 'opening' | 'open' | 'closing';
export type BookSection = 'catalog' | 'keys';
export type CatalogTab = 'ALL' | 'CATEGORY' | 'ERA';

/** 版面常數：要跟 artifact-list.scss 的 .group-head／.card-row／.artifact-card 一致 */
export const BOOK_LAYOUT = {
  gap: 10,
  minCardW: 92,
  /** 卡片名稱列（含與圖框的間距）高度 */
  labelH: 26,
  /** 圖框高度 = 卡片寬 × 這個比例 */
  frameRatio: 0.86,
  /** 分區標題高度（含下方間距） */
  headerH: 36,
} as const;

/** 年代先後排序用：沒有年代資料的排到最後 */
export function compareEraOrder(
  a: string,
  b: string,
  order: ReadonlyMap<string, { start: number; end: number }>,
): number {
  const ea = order.get(a);
  const eb = order.get(b);
  if (ea && eb) return ea.start - eb.start || ea.end - eb.end || a.localeCompare(b);
  if (ea) return -1;
  if (eb) return 1;
  return a.localeCompare(b);
}

/**
 * 計算單頁可以放幾欄、卡片多大。寬度不足兩欄時仍維持兩欄，避免小螢幕只剩一張卡。
 */
export function computeCatalogLayout(width: number, height: number): CatalogLayout | null {
  if (width <= 0 || height <= 0) return null;
  const { gap, minCardW, labelH, frameRatio } = BOOK_LAYOUT;
  const cols = Math.max(2, Math.floor((width + gap) / (minCardW + gap)));
  const cardW = Math.floor((width - gap * (cols - 1)) / cols);
  const cardH = Math.round(cardW * frameRatio) + labelH;
  return { cols, cardW, cardH, rowH: cardH + gap, bodyH: Math.floor(height) };
}

/**
 * 把分區依頁面高度切成多頁：
 * - 分區標題不會單獨留在頁尾（放不下標題＋第一列就換頁）
 * - 分區跨頁時，新的一頁開頭：showContinuedHeader(頁碼) 為 true 補「（續）」標題（左頁），
 *   否則只留分隔線（右頁），避免左右兩頁都出現年代標題與收合按鈕
 * - 收合狀態只顯示第一列（cols 張），展開才顯示全部
 */
export function paginateCatalog(
  groups: CatalogGroup[],
  layout: CatalogLayout,
  isExpanded: (group: CatalogGroup) => boolean,
  showContinuedHeader: (pageIndex: number) => boolean = () => true,
): CatalogPage[] {
  const { headerH } = BOOK_LAYOUT;
  const pages: CatalogPage[] = [];
  let lines: CatalogLine[] = [];
  let used = 0;
  const flush = () => {
    pages.push({ lines });
    lines = [];
    used = 0;
  };

  for (const group of groups) {
    const visible = isExpanded(group) ? group.items : group.items.slice(0, layout.cols);
    if (lines.length && used + headerH + layout.rowH > layout.bodyH) flush();
    lines.push({ kind: 'header', key: `h:${group.key}`, group, continued: false });
    used += headerH;

    for (let start = 0, row = 0; start < visible.length; start += layout.cols, row++) {
      if (used + layout.rowH > layout.bodyH && lines.length) {
        flush();
        lines.push(
          showContinuedHeader(pages.length)
            ? { kind: 'header', key: `c:${group.key}:${row}`, group, continued: true }
            : { kind: 'divider', key: `d:${group.key}:${row}`, group },
        );
        used += headerH;
      }
      lines.push({ kind: 'row', key: `r:${group.key}:${row}`, group, items: visible.slice(start, start + layout.cols) });
      used += layout.rowH;
    }
  }

  if (lines.length) flush();
  return pages;
}

@Component({
  selector: 'app-artifact-list',
  standalone: true,
  imports: [CommonModule, FormsModule, KeyList, ArtifactDiscussionDialog],
  templateUrl: './artifact-list.html',
  // 封面、書本、彈出視窗的樣式拆成三個檔案，避免單一樣式檔超過 angular.json 的 32kB 預算；
  // 封面要放在最前面，artifact-list.scss 裡的窄螢幕規則才能覆寫它。
  styleUrls: ['./artifact-list.cover.scss', './artifact-list.scss', './artifact-list.dialogs.scss'],
})
export class ArtifactList implements OnInit, AfterViewInit, OnDestroy {
  // ---- 文物清單 ----
  // 版面需要「全部」文物才能正確分組與搜尋，所以把後端全部分頁串接起來一次載入。
  // 型別是 CompendiumCardSummary：格狀列表只需要清單欄位＋外皮＋解鎖狀態，
  // 鑑賞細節只在點開卡片時才透過 CatalogService.getArtifactById() 取得。
  catalogModel = signal<CompendiumCardSummary[]>([]);
  loading = signal(true);
  errorMsg = signal('');
  totalCount = signal(0);
  unlockStatusReady = signal(false);
  unlockStatusError = signal('');

  // ---- 圖鑑放大檢視／解鎖 ----
  keys = signal(0); // 全部鑰匙的持有總數，上方「鑰匙背包」頁籤徽章用
  /** 背包內全部鑰匙；左側鑰匙篩選頁籤的數量用，鑰匙背包內有變動時由 KeyList 回報 */
  allKeys = signal<KeyModel[]>([]);
  /** 萬能鑰匙（如果有的話）；圖鑑卡片上的解鎖按鈕固定用這把 */
  universalKey = signal<KeyModel | null>(null);
  readonly universalKeyAssetPath = keyAssetPath('UNIVERSAL');
  // integration: 後端目前的 UnlockArtifactAsync 固定扣除 1 把鑰匙。
  unlockKeyCost = computed(() => 1);
  unlockLedger = signal<ArtifactUnlockRecord[]>([]);
  unlockError = signal('');
  unlockedCount = computed(() => this.catalogModel().filter((i) => i.unlocked).length);
  filteredUnlockedCount = computed(() => this.filteredItems().filter((i) => i.unlocked).length);
  catalogViewReady = computed(() => !this.loading() && !this.errorMsg() && this.unlockStatusReady());
  unlocking = signal(false);

  // ---- 一鍵解鎖全部（消耗萬能鑰匙）----
  lockedTotalCount = computed(() => this.catalogModel().filter((i) => !i.unlocked).length);
  bulkUnlockPlannedCount = computed(() =>
    Math.min(this.universalKey()?.balance ?? 0, this.lockedTotalCount())
  );
  bulkUnlockConfirmOpen = signal(false);
  bulkUnlocking = signal(false);
  bulkUnlockError = signal('');
  bulkUnlockResult = signal<{ unlockedCount: number } | null>(null);

  focusedId = signal<string | null>(null);
  infoOpen = signal(false);
  confirmTargetId = signal<string | null>(null);

  focusedDetail = signal<CatalogDetailModel | null>(null);
  focusedDetailLoading = signal(false);
  focusedDetailError = signal('');

  discussionTargetId = signal<string | null>(null);
  discussionTarget = computed<CompendiumCardSummary | null>(() => {
    const id = this.discussionTargetId();
    return id ? this.catalogModel().find((item) => item.id === id) ?? null : null;
  });
  discussionDialogOpen = computed(() => this.discussionTargetId() !== null);
  discussionInitialComment = signal('');
  discussionLoading = signal(false);
  discussionError = signal('');

  // ================= 書本狀態 =================

  /** closed：只看到封面；opening／closing：翻頁動畫中；open：書本攤開 */
  bookState = signal<BookState>('closed');
  /** 書本上方頁籤：圖鑑／鑰匙背包 */
  bookSection = signal<BookSection>('catalog');
  /**
   * 書本左側頁籤（圖鑑模式）：全部／分類／年代。
   * 分類、年代不是獨立頁面，只是叫出疊在左頁上的篩選單；兩邊的勾選同時生效，
   * 切回「全部」時自動清除。
   */
  catalogTab = signal<CatalogTab>('ALL');
  /** 分類／年代篩選單是否展開；頁籤維持選取時可以先收起篩選單看結果 */
  filterPanelOpen = signal(false);
  /** 書本左側頁籤（鑰匙背包模式）：交給 KeyList 篩選 */
  keyFilter = signal<KeyFilter>('ALL');

  readonly catalogTabs: { id: CatalogTab; label: string }[] = [
    { id: 'ALL', label: '全部' },
    { id: 'CATEGORY', label: '分類' },
    { id: 'ERA', label: '年代' },
  ];

  readonly keyTabs: { id: KeyFilter; label: string }[] = [
    { id: 'ALL', label: '全部' },
    { id: 'CATEGORY', label: '分類' },
    { id: 'ERA', label: '年代' },
    { id: 'UNIVERSAL', label: '萬能' },
    { id: 'NORMAL', label: '一般' },
  ];

  /** 目前翻到第幾個跨頁（全部頁籤＝左右兩頁一組；分類／年代頁籤＝右頁一頁一組） */
  spread = signal(0);
  /** 翻頁動畫方向；null 代表沒有在翻頁 */
  turning = signal<'next' | 'prev' | null>(null);
  /** 書頁內容區（扣掉頁首搜尋列與頁尾翻頁列）的實際大小，由 ResizeObserver 回報 */
  pageBox = signal<{ w: number; h: number }>({ w: 0, h: 0 });

  @ViewChild('pageMeasure', { static: true }) private pageMeasure?: ElementRef<HTMLElement>;
  private resizeObserver?: ResizeObserver;
  private timers: ReturnType<typeof setTimeout>[] = [];

  // ---- 搜尋／篩選 ----
  searchQuery = signal('');
  unlockedOnly = signal(false);
  /** 年代／分類核取方塊，空集合代表不篩選；兩組同時生效（組內 OR、組間 AND） */
  selectedEras = signal<Set<string>>(new Set());
  selectedCategories = signal<Set<string>>(new Set());

  /**
   * 年代的先後（GET /catalog/eras 的 startYear／endYear，西元前為負數），
   * 以年代代碼與名稱都建一份，文物資料不論帶哪一種都對得上。
   */
  private eraOrder = signal<Map<string, { start: number; end: number }>>(new Map());

  private compareEra = (a: CompendiumCardSummary, b: CompendiumCardSummary): number => {
    const order = this.eraOrder();
    const ka = order.has(a.eraCode) ? a.eraCode : a.eraName;
    const kb = order.has(b.eraCode) ? b.eraCode : b.eraName;
    return compareEraOrder(ka, kb, order);
  };

  /** 篩選單的年代選項也依年代先後排列 */
  eraOptions = computed(() => {
    const first = new Map<string, CompendiumCardSummary>();
    for (const item of this.catalogModel()) if (!first.has(item.eraName)) first.set(item.eraName, item);
    return Array.from(first.values()).sort(this.compareEra).map((item) => item.eraName);
  });

  categoryOptions = computed(() => {
    const names = new Set(this.catalogModel().map((i) => i.categoryName));
    return Array.from(names).sort();
  });

  /**
   * 搜尋框＋「僅顯示已解鎖」：三個左側頁籤共用。
   * 關鍵字比對：編號／年代／分類一律可比對；名字只比對已解鎖的文物
   * （未解鎖的名稱是「？？？」謎底，不應該被搜出來）。
   */
  private searchedItems = computed<CompendiumCardSummary[]>(() => {
    const keyword = this.searchQuery().trim().toLowerCase();
    const unlockedOnly = this.unlockedOnly();

    return this.catalogModel().filter((item) => {
      if (unlockedOnly && !item.unlocked) return false;
      if (!keyword) return true;
      return (
        item.artifactRef.toLowerCase().includes(keyword) ||
        item.eraName.toLowerCase().includes(keyword) ||
        item.categoryName.toLowerCase().includes(keyword) ||
        (item.unlocked && item.name.toLowerCase().includes(keyword))
      );
    });
  });

  /** 搜尋＋年代＋分類核取方塊（任一頁籤勾的都會同時生效） */
  filteredItems = computed<CompendiumCardSummary[]>(() => {
    const eras = this.selectedEras();
    const categories = this.selectedCategories();
    return this.searchedItems().filter(
      (i) => (!eras.size || eras.has(i.eraName)) && (!categories.size || categories.has(i.categoryName)),
    );
  });

  /** 依年代分區，年代由遠到近排列，區內依分類排 */
  private eraGroupsOf(items: CompendiumCardSummary[]): CatalogGroup[] {
    const groups = new Map<string, CompendiumCardSummary[]>();
    for (const item of items) {
      const list = groups.get(item.eraName) ?? [];
      list.push(item);
      groups.set(item.eraName, list);
    }
    return Array.from(groups.entries())
      .map(([label, list]) => ({
        key: `era:${label}`,
        label,
        items: [...list].sort((a, b) => a.categoryCode.localeCompare(b.categoryCode)),
      }))
      .sort((a, b) => this.compareEra(a.items[0], b.items[0]));
  }

  /** 篩選後的全部年代分區（不受展開影響） */
  private filteredEraGroups = computed(() => this.eraGroupsOf(this.filteredItems()));

  /** 目前展開中的年代（一次只展開一個；展開時其他年代先隱藏） */
  expandedGroupKey = signal<string | null>(null);

  /**
   * 書頁上實際排版的分區：有年代展開時只剩那個年代，收合後才顯示全部。
   * 展開的年代被搜尋／篩選掉時，退回顯示全部。
   */
  catalogGroups = computed<CatalogGroup[]>(() => {
    const groups = this.filteredEraGroups();
    const key = this.expandedGroupKey();
    const expanded = key ? groups.find((group) => group.key === key) : undefined;
    return expanded ? [expanded] : groups;
  });

  /** 跟書頁同一套年代排序，但依據整本圖鑑——一鍵解鎖由上至下的順序不受搜尋／篩選影響 */
  private allEraGroups = computed<EraGroup[]>(() =>
    this.eraGroupsOf(this.catalogModel()).map((group) => ({ eraName: group.label, items: group.items })),
  );

  isEmpty = computed(() => !this.loading() && !this.errorMsg() && this.catalogGroups().length === 0);

  isGroupExpanded(group: CatalogGroup): boolean {
    return this.expandedGroupKey() === group.key;
  }

  /** 左側頁籤上的勾選數 */
  selectedFilterCount(tab: CatalogTab): number {
    if (tab === 'ERA') return this.selectedEras().size;
    if (tab === 'CATEGORY') return this.selectedCategories().size;
    return 0;
  }

  /** 篩選單底部的摘要 */
  filterSummary = computed(() => {
    const eras = this.selectedEras().size;
    const categories = this.selectedCategories().size;
    if (!eras && !categories) return '尚未勾選，顯示全部文物';
    return [eras ? `年代 ${eras} 項` : '', categories ? `分類 ${categories} 項` : ''].filter(Boolean).join('・');
  });

  /** 書頁目前的卡片尺寸；書頁還沒量到大小前是 null */
  layout = computed(() => computeCatalogLayout(this.pageBox().w, this.pageBox().h));

  /** 收合時每個分區顯示的數量＝一列放得下的張數 */
  previewCount = computed(() => this.layout()?.cols ?? 4);

  pages = computed<CatalogPage[]>(() => {
    const layout = this.layout();
    if (!layout) return [];
    const key = this.expandedGroupKey();
    const filterMode = this.filterMode();
    // 兩頁翻閱時只有左頁補「（續）」標題與收合按鈕，右頁只留分隔線；
    // 篩選單開著時每次只翻右頁，每一頁都要有標題
    return paginateCatalog(
      this.catalogGroups(),
      layout,
      (group) => group.key === key,
      (index) => filterMode || index % 2 === 0,
    );
  });

  /**
   * 篩選單開著時（分類／年代頁籤），左頁整頁是篩選單，文物只排在右頁、一次翻一頁；
   * 收起篩選單或切回全部後，恢復左右兩頁一起翻。
   */
  filterMode = computed(() => this.catalogTab() !== 'ALL' && this.filterPanelOpen());

  private pagesPerSpread = computed(() => (this.filterMode() ? 1 : 2));

  spreadCount = computed(() => Math.max(1, Math.ceil(this.pages().length / this.pagesPerSpread())));

  currentSpread = computed(() => Math.min(Math.max(this.spread(), 0), this.spreadCount() - 1));

  leftPage = computed<CatalogPage | null>(() =>
    this.filterMode() ? null : this.pages()[this.currentSpread() * 2] ?? null,
  );
  rightPage = computed<CatalogPage | null>(() =>
    this.filterMode()
      ? this.pages()[this.currentSpread()] ?? null
      : this.pages()[this.currentSpread() * 2 + 1] ?? null,
  );

  canTurnPrev = computed(() => this.currentSpread() > 0);
  canTurnNext = computed(() => this.currentSpread() < this.spreadCount() - 1);

  leftPageNumber = computed(() => (this.filterMode() ? null : this.currentSpread() * 2 + 1));
  rightPageNumber = computed(() => {
    const n = this.filterMode() ? this.currentSpread() + 1 : this.currentSpread() * 2 + 2;
    return n <= this.pages().length ? n : null;
  });

  /** 內容頁索引 → 跨頁索引 */
  private spreadOfPage(index: number): number {
    return Math.floor(index / this.pagesPerSpread());
  }
  totalPageCount = computed(() => Math.max(1, this.pages().length));

  @Output() appreciationRequested = new EventEmitter<CardEntry>();

  constructor(
    private catalogService: CatalogService,
    private keyService: KeyService,
    private socialApi: SocialApiService,
    private router: Router,
    private route: ActivatedRoute,
    private zone: NgZone,
  ) { }

  ngOnInit(): void {
    // ui-integration: 商城「年代選藏」帶 ?era= 進來時，直接翻開書並切到年代頁籤。
    const query = this.route.snapshot.queryParamMap;
    const era = query.get('era')?.trim();
    if (era) {
      this.selectedEras.set(new Set([era]));
      this.catalogTab.set('ERA'); // 頁籤停在年代並顯示勾選數；篩選單先收起，直接看到結果
    }
    // 從其他頁面指定文物（?focus=）或年代進來時，不必再點一次封面
    if (era || query.get('focus')) this.bookState.set('open');

    this.loadArtifacts();
    this.loadKeyBalance();
    this.loadEraOrder();
  }

  ngAfterViewInit(): void {
    const el = this.pageMeasure?.nativeElement;
    if (!el || typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width);
      const h = Math.floor(entry.contentRect.height);
      const current = this.pageBox();
      if (current.w === w && current.h === h) return;
      this.zone.run(() => this.pageBox.set({ w, h }));
    });
    this.resizeObserver.observe(el);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.timers.forEach((timer) => clearTimeout(timer));
  }

  // ================= 書本：開闔、頁籤、翻頁 =================

  openBook(): void {
    if (this.bookState() !== 'closed') return;
    if (this.prefersReducedMotion()) {
      this.bookState.set('open');
      return;
    }
    this.bookState.set('opening');
    this.later(1200, () => this.bookState.set('open'));
  }

  /** 闔上書本；完全闔上後切回「圖鑑」章節並收合展開中的年代，下次翻開從圖鑑開始 */
  closeBook(): void {
    if (this.bookState() !== 'open') return;
    const finish = () => {
      this.bookState.set('closed');
      this.setSection('catalog');
      this.expandedGroupKey.set(null);
      this.spread.set(0);
    };
    if (this.prefersReducedMotion()) {
      finish();
      return;
    }
    this.bookState.set('closing');
    this.later(1100, finish);
  }

  onCoverKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.openBook();
  }

  setSection(section: BookSection): void {
    if (this.bookSection() === section) return;
    this.bookSection.set(section);
    this.expandedGroupKey.set(null);
    this.spread.set(0);
    // 玩家在背包裡可能用掉鑰匙、解鎖了文物；回到圖鑑時重新同步
    if (section === 'catalog') {
      this.loadKeyBalance();
      this.loadUnlockStatus();
    }
  }

  /**
   * 全部：清除年代／分類勾選並收起篩選單。
   * 分類／年代：叫出篩選單；再點一次已選取的頁籤則收起／展開篩選單。
   */
  setCatalogTab(tab: CatalogTab): void {
    // 切換頁籤時收合展開中的年代
    if (tab !== this.catalogTab()) this.expandedGroupKey.set(null);
    if (tab === 'ALL') {
      const hadFilter = this.selectedEras().size > 0 || this.selectedCategories().size > 0;
      this.catalogTab.set('ALL');
      this.filterPanelOpen.set(false);
      if (hadFilter) this.clearSelections();
      return;
    }
    if (this.catalogTab() === tab) {
      this.filterPanelOpen.update((open) => !open);
      this.spread.set(0);
      return;
    }
    this.catalogTab.set(tab);
    this.filterPanelOpen.set(true);
    this.spread.set(0);
  }

  closeFilterPanel(): void {
    this.filterPanelOpen.set(false);
    this.spread.set(0);
  }

  setKeyFilter(filter: KeyFilter): void {
    this.keyFilter.set(filter);
  }

  /** 左側鑰匙頁籤上的數量：該類型持有中鑰匙的把數總和 */
  keyFilterCount(filter: KeyFilter): number {
    return this.allKeys()
      .filter((key) => key.balance > 0 && (filter === 'ALL' || key.scopeType === filter))
      .reduce((sum, key) => sum + key.balance, 0);
  }

  /** dir：1 下一頁、-1 上一頁；翻頁動畫進行一半時才換內容 */
  turnPage(dir: 1 | -1): void {
    if (this.turning()) return;
    const target = this.currentSpread() + dir;
    if (target < 0 || target >= this.spreadCount()) return;
    if (this.prefersReducedMotion()) {
      this.spread.set(target);
      return;
    }
    this.turning.set(dir > 0 ? 'next' : 'prev');
    this.later(280, () => this.spread.set(target));
    this.later(640, () => this.turning.set(null));
  }

  /** 書本攤開、停在圖鑑時，可用鍵盤左右鍵翻頁（輸入框內與彈出視窗開著時不處理） */
  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (this.bookState() !== 'open' || this.bookSection() !== 'catalog') return;
    if (this.isOverlayOpen() || this.confirmTargetId() || this.bulkUnlockConfirmOpen() || this.discussionDialogOpen()) return;
    if (event.key === 'Escape' && this.filterPanelOpen()) {
      this.closeFilterPanel();
      return;
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
    event.preventDefault();
    this.turnPage(event.key === 'ArrowRight' ? 1 : -1);
  }

  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.spread.set(0);
  }

  toggleUnlockedFilter(): void {
    this.unlockedOnly.update((active) => !active);
    this.spread.set(0);
  }

  toggleEraFilter(era: string): void {
    this.selectedEras.update((set) => {
      const next = new Set(set);
      if (next.has(era)) next.delete(era); else next.add(era);
      return next;
    });
    this.spread.set(0);
  }

  isEraSelected(era: string): boolean {
    return this.selectedEras().has(era);
  }

  toggleCategoryFilter(category: string): void {
    this.selectedCategories.update((set) => {
      const next = new Set(set);
      if (next.has(category)) next.delete(category); else next.add(category);
      return next;
    });
    this.spread.set(0);
  }

  isCategorySelected(category: string): boolean {
    return this.selectedCategories().has(category);
  }

  /** 清除年代＋分類勾選（兩個篩選頁籤同步） */
  clearSelections(): void {
    this.selectedEras.set(new Set());
    this.selectedCategories.set(new Set());
    this.spread.set(0);
  }

  /** 搜尋、已解鎖、年代、分類全部恢復預設 */
  clearFilters(): void {
    this.searchQuery.set('');
    this.unlockedOnly.set(false);
    this.selectedEras.set(new Set());
    this.selectedCategories.set(new Set());
    this.spread.set(0);
  }

  /**
   * 展開：隱藏其他年代，只看這個年代，從第一個跨頁的左頁開始。
   * 收合：其他年代重新出現，翻回這個年代所在的跨頁。
   */
  toggleGroupExpand(group: CatalogGroup): void {
    if (this.expandedGroupKey() === group.key) {
      this.expandedGroupKey.set(null);
      const index = this.pages().findIndex((page) =>
        page.lines.some((line) => line.kind === 'header' && !line.continued && line.group.key === group.key),
      );
      this.spread.set(index >= 0 ? this.spreadOfPage(index) : 0);
      return;
    }
    this.expandedGroupKey.set(group.key);
    this.spread.set(0);
  }

  /** 翻到某件文物所在的頁面；被收合時先展開它的分區 */
  private revealItem(artifactId: string): void {
    const item = this.catalogModel().find((i) => i.id === artifactId);
    if (!item) return;

    let index = this.pageIndexOf(artifactId);
    if (index < 0) {
      // 被收合或被其他年代的展開隱藏：展開它所在的年代
      this.expandedGroupKey.set(`era:${item.eraName}`);
      index = this.pageIndexOf(artifactId);
    }
    if (index < 0 && this.catalogTab() !== 'ALL') {
      // 被年代／分類勾選篩掉：切回全部（會清除勾選）
      this.setCatalogTab('ALL');
      this.expandedGroupKey.set(`era:${item.eraName}`);
      index = this.pageIndexOf(artifactId);
    }
    if (index >= 0) this.spread.set(this.spreadOfPage(index));
  }

  private pageIndexOf(artifactId: string): number {
    return this.pages().findIndex((page) =>
      page.lines.some((line) => line.kind === 'row' && line.items.some((i) => i.id === artifactId)),
    );
  }

  trackByArtifactId(_index: number, item: CompendiumCardSummary): string {
    return item.id;
  }

  cardLabel(item: CompendiumCardSummary): string {
    return `${item.unlocked ? item.name : '尚未解鎖的文物'}，${item.categoryName}，${item.eraName}`;
  }

  cardTitle(item: CompendiumCardSummary): string {
    return `No. ${item.artifactRef}\n${item.unlocked ? item.name : '？？？'}\n${item.categoryName}・${item.eraName}`;
  }

  // ================= 資料載入 =================

  loadArtifacts(): void {
    this.loading.set(true);
    this.errorMsg.set('');

    this.fetchAllPages(1, []).subscribe({
      next: (models) => {
        this.catalogModel.set(models.map((model) => this.toCardSummary(model)));
        this.totalCount.set(models.length);
        this.loading.set(false);
        this.unlockStatusReady.set(false);
        this.unlockStatusError.set('');
        this.loadUnlockStatus(true);
      },
      error: (err) => {
        this.errorMsg.set(err.message);
        this.loading.set(false);
      },
    });
  }

  /** 文物清單載入完成後，再打 GET /me/catalog/unlocks 補上真實解鎖狀態 */
  private loadUnlockStatus(initialLoad = false): void {
    if (initialLoad) this.unlockStatusReady.set(false);
    this.unlockStatusError.set('');

    this.catalogService.getMyArtifactUnlocks().subscribe({
      next: (records) => {
        const unlockedAtByArtifactId = new Map(records.map((r) => [r.artifactId, r.unlockedAt]));

        this.catalogModel.update((list) =>
          list.map((item) => {
            const unlockedAt = unlockedAtByArtifactId.get(item.id);
            return unlockedAt !== undefined ? { ...item, unlocked: true, unlockedAt } : item;
          })
        );

        this.unlockLedger.set(records);
        this.unlockStatusReady.set(true);
        if (initialLoad) this.focusFromQueryParamIfAny();
      },
      error: (err) => {
        this.unlockStatusError.set('解鎖狀態目前無法載入，請稍後再試。');
        console.error('[ArtifactList] loadUnlockStatus failed', err);
      },
    });
  }

  private focusFromQueryParamIfAny(): void {
    const focusId = this.route.snapshot.queryParamMap.get('focus');
    if (focusId && this.catalogModel().some((i) => i.id === focusId)) {
      this.revealItem(focusId);
      this.openCard(focusId);
    }
  }

  private fetchAllPages(page: number, acc: CatalogModel[]): Observable<CatalogModel[]> {
    const bulkPageSize = 100;
    return this.catalogService.getArtifacts(page, bulkPageSize).pipe(
      switchMap((res) => {
        const combined = [...acc, ...res.items];
        return page < res.totalPages ? this.fetchAllPages(page + 1, combined) : of(combined);
      })
    );
  }

  /** 讀取年代對照表（含起訖年），書頁依年代先後排列；失敗時退回依名稱排序 */
  private loadEraOrder(): void {
    this.catalogService.getEras().subscribe({
      next: (eras: EraModel[]) => {
        const order = new Map<string, { start: number; end: number }>();
        for (const era of eras) {
          const start = Number(era.startYear);
          if (!Number.isFinite(start)) continue;
          const span = { start, end: Number.isFinite(Number(era.endYear)) ? Number(era.endYear) : start };
          order.set(era.code, span);
          order.set(era.name, span);
        }
        this.eraOrder.set(order);
      },
      error: (err) => console.error('[ArtifactList] loadEraOrder failed', err),
    });
  }

  private loadKeyBalance(): void {
    this.keyService.getKeys().subscribe({
      next: (allKeys) => this.onKeysChanged(allKeys),
      error: (err) => console.error('[ArtifactList] loadKeyBalance failed', err),
    });
  }

  /** KeyList（鑰匙背包頁）每次重新讀取鑰匙時也會呼叫這裡，讓頁籤數量與萬能鑰匙餘額保持同步 */
  onKeysChanged(allKeys: KeyModel[]): void {
    this.allKeys.set(allKeys);
    this.keys.set(allKeys.reduce((sum, key) => sum + key.balance, 0));
    this.universalKey.set(allKeys.find((key) => key.scopeType === 'UNIVERSAL') ?? null);
  }

  private toCardSummary(model: CatalogModel): CompendiumCardSummary {
    const placeholderSkin: CompendiumSkin = {
      color: '#2a5cad',
      type: model.categoryName,
      rarity: '★★☆☆☆',
      habitat: '－',
      desc: '',
    };

    return {
      ...model,
      ...placeholderSkin,
      unlocked: false,
      unlockedAt: null,
    };
  }

  getImageUrl(path: string): string {
    return path;
  }

  // ================= 放大檢視／解鎖 =================

  focusedItem = computed<CompendiumCardSummary | null>(() => {
    const id = this.focusedId();
    if (id === null) return null;
    return this.catalogModel().find((i) => i.id === id) ?? null;
  });

  focusedCardEntry = computed<CardEntry | null>(() => {
    const item = this.focusedItem();
    const detail = this.focusedDetail();
    if (!item || !item.unlocked || !detail || detail.id !== item.id) return null;
    return { ...item, ...detail };
  });

  isOverlayOpen = computed(() => this.focusedId() !== null);

  confirmTarget = computed<CompendiumCardSummary | null>(() => {
    const id = this.confirmTargetId();
    if (id === null) return null;
    return this.catalogModel().find((i) => i.id === id) ?? null;
  });

  confirmCost = computed(() => this.unlockKeyCost());

  confirmInsufficient = computed(() => (this.universalKey()?.balance ?? 0) < this.unlockKeyCost());

  openCard(id: string): void {
    this.focusedId.set(id);
    this.infoOpen.set(false);
    this.focusedDetail.set(null);
    this.focusedDetailError.set('');
    this.maybeLoadFocusedDetail();
  }

  closeOverlay(): void {
    this.focusedId.set(null);
    this.infoOpen.set(false);
  }

  toggleInfo(): void {
    this.infoOpen.update((v) => !v);
  }

  onOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeOverlay();
    }
  }

  focusedImagePath(item: CompendiumCardSummary): string {
    return this.focusedCardEntry()?.primaryImagePath ?? item.thumbnailPath;
  }

  private maybeLoadFocusedDetail(): void {
    const item = this.focusedItem();
    if (!item?.unlocked) return;
    if (this.focusedDetail()?.id === item.id) return;

    this.focusedDetailLoading.set(true);
    this.focusedDetailError.set('');
    this.catalogService.getArtifactById(item.id).subscribe({
      next: (detail) => {
        this.focusedDetail.set(detail);
        this.focusedDetailLoading.set(false);
      },
      error: (err) => {
        this.focusedDetailError.set(err.message);
        this.focusedDetailLoading.set(false);
      },
    });
  }

  /** 先查詢已發布的一般貼文；已有討論就直接導向，沒有才讓會員確認並輸入第一則留言 */
  openDiscussion(artifactId: string): void {
    if (this.discussionLoading()) return;

    this.discussionLoading.set(true);
    this.discussionError.set('');
    this.socialApi.getPosts({ artifactId, postType: 'POST', page: 1, pageSize: 1 }).subscribe({
      next: (page) => {
        this.discussionLoading.set(false);
        const existingPost = page.items[0];
        if (existingPost) {
          this.router.navigate(['/social/posts', existingPost.id]);
          return;
        }

        this.discussionInitialComment.set('');
        this.discussionTargetId.set(artifactId);
      },
      error: (error) => {
        this.discussionLoading.set(false);
        this.discussionError.set(this.getDiscussionErrorMessage(error));
      },
    });
  }

  cancelDiscussion(): void {
    if (this.discussionLoading()) return;
    this.discussionTargetId.set(null);
    this.discussionInitialComment.set('');
    this.discussionError.set('');
  }

  submitDiscussion(): void {
    const target = this.discussionTarget();
    const initialComment = this.discussionInitialComment().trim();
    if (!target || this.discussionLoading()) return;
    if (!initialComment) {
      this.discussionError.set('請先留下第一則討論留言。');
      return;
    }

    this.discussionLoading.set(true);
    this.discussionError.set('');
    this.socialApi.ensureArtifactDiscussion(target.id, { initialComment }).subscribe({
      next: (result) => {
        this.discussionLoading.set(false);
        this.cancelDiscussion();
        this.router.navigate(['/social/posts', result.postId]);
      },
      error: (error) => {
        this.discussionLoading.set(false);
        this.discussionError.set(this.getDiscussionErrorMessage(error));
      },
    });
  }

  onDiscussionOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cancelDiscussion();
    }
  }

  private getDiscussionErrorMessage(error: any): string {
    return error?.error?.detail
      ?? error?.error?.title
      ?? error?.message
      ?? '社群討論目前無法使用，請稍後再試。';
  }

  openUnlockConfirm(id: string): void {
    this.unlockError.set('');
    this.confirmTargetId.set(id);
  }

  cancelUnlockConfirm(): void {
    if (this.unlocking()) return;
    this.confirmTargetId.set(null);
    this.unlockError.set('');
  }

  /**
   * 圖鑑卡片上的解鎖按鈕固定使用萬能鑰匙，呼叫 unlockWithKey() 並帶上 artifactId。
   * 後端回應沒有鑰匙餘額與完整流水，成功後重新呼叫 loadKeyBalance()／loadUnlockStatus()。
   */
  confirmUnlock(): void {
    const target = this.confirmTarget();
    if (!target) return;
    if (this.unlocking()) return;
    if (this.confirmInsufficient()) return;

    const universal = this.universalKey();
    if (!universal) return;

    this.unlockError.set('');
    this.unlocking.set(true);

    this.keyService.unlockWithKey(universal.code, target.id).subscribe({
      next: (result) => {
        this.unlocking.set(false);
        this.loadKeyBalance();

        // 後端在「沒有符合條件的文物」時回 HTTP 200 + unlocked:false，要另外檢查
        if (!result.unlocked) {
          this.unlockError.set(result.message ?? '目前沒有符合條件的文物可以解鎖。');
          return;
        }

        this.catalogModel.update((list) =>
          list.map((i) =>
            i.id === target.id ? { ...i, unlocked: true, unlockedAt: new Date().toISOString() } : i
          )
        );
        this.confirmTargetId.set(null);
        this.loadUnlockStatus();

        if (this.focusedId() === target.id) {
          this.maybeLoadFocusedDetail();
        }
      },
      error: (err) => {
        this.unlocking.set(false);
        console.error('[ArtifactList] unlock failed', err);
        this.unlockError.set(err?.message ?? '解鎖失敗，請稍後再試');
      },
    });
  }

  onConfirmOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cancelUnlockConfirm();
    }
  }

  openBulkUnlockConfirm(): void {
    if (this.lockedTotalCount() === 0) return;
    this.bulkUnlockError.set('');
    this.bulkUnlockResult.set(null);
    this.bulkUnlockConfirmOpen.set(true);
  }

  cancelBulkUnlock(): void {
    if (this.bulkUnlocking()) return;
    this.bulkUnlockConfirmOpen.set(false);
  }

  onBulkUnlockOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cancelBulkUnlock();
    }
  }

  closeBulkUnlockResult(): void {
    this.bulkUnlockConfirmOpen.set(false);
    this.bulkUnlockResult.set(null);
    this.bulkUnlockError.set('');
  }

  /**
   * 一鍵解鎖全部：依「圖鑑由上至下」的順序（allEraGroups 攤平）逐一呼叫真正的解鎖 API，
   * 後端對某一筆回 unlocked:false 就停止；停在哪筆由後端真實狀態決定。
   */
  confirmBulkUnlock(): void {
    if (this.bulkUnlocking()) return;

    const universal = this.universalKey();
    if (!universal || universal.balance < 1) {
      this.bulkUnlockError.set('目前沒有萬能鑰匙，無法使用一鍵解鎖。');
      return;
    }

    const queue = this.allEraGroups()
      .flatMap((group) => group.items)
      .filter((item) => !item.unlocked);

    if (queue.length === 0) {
      this.bulkUnlockError.set('目前沒有尚未解鎖的文物。');
      return;
    }

    this.bulkUnlockError.set('');
    this.bulkUnlocking.set(true);
    this.runBulkUnlockStep(universal.code, queue, 0, 0);
  }

  private runBulkUnlockStep(
    keyCode: string,
    queue: CompendiumCardSummary[],
    index: number,
    unlockedCount: number
  ): void {
    if (index >= queue.length) {
      this.finishBulkUnlock(unlockedCount);
      return;
    }

    const target = queue[index];
    this.keyService.unlockWithKey(keyCode, target.id).subscribe({
      next: (result) => {
        if (!result.unlocked) {
          this.finishBulkUnlock(unlockedCount, result.message ?? undefined);
          return;
        }

        this.catalogModel.update((list) =>
          list.map((i) =>
            i.id === target.id ? { ...i, unlocked: true, unlockedAt: new Date().toISOString() } : i
          )
        );
        this.runBulkUnlockStep(keyCode, queue, index + 1, unlockedCount + 1);
      },
      error: (err) => {
        console.error('[ArtifactList] bulk unlock step failed', err);
        this.finishBulkUnlock(unlockedCount, err?.message ?? '解鎖過程發生錯誤，已停止一鍵解鎖。');
      },
    });
  }

  private finishBulkUnlock(unlockedCount: number, message?: string): void {
    this.bulkUnlocking.set(false);
    this.bulkUnlockResult.set({ unlockedCount });
    if (message) this.bulkUnlockError.set(message);
    this.loadKeyBalance();
    this.loadUnlockStatus();

    if (this.focusedId()) {
      this.maybeLoadFocusedDetail();
    }
  }

  onAppreciationClick(item: CardEntry): void {
    this.appreciationRequested.emit(item);
    void this.router.navigate(['/game/appreciation'], { queryParams: { artifactId: item.id } });
  }

  goBackToMember(): void {
    this.router.navigate(['/member']);
  }

  /**
   * 鑰匙背包頁按「前往查看」（KeyList emit 的事件）：切回圖鑑頁籤、翻到那件文物所在的頁，
   * 並直接打開放大檢視，不整頁導頁。
   */
  onArtifactFocusRequestedFromKeyBag(artifactId: string): void {
    this.setSection('catalog');

    // 先樂觀標成已解鎖，避免 loadUnlockStatus() 回來前卡片先閃一下「未解鎖」
    this.catalogModel.update((list) =>
      list.map((i) =>
        i.id === artifactId ? { ...i, unlocked: true, unlockedAt: i.unlockedAt ?? new Date().toISOString() } : i
      )
    );
    this.revealItem(artifactId);
    this.openCard(artifactId);
  }

  itemByArtifactId(artifactId: string): CompendiumCardSummary | undefined {
    return this.catalogModel().find((i) => i.id === artifactId);
  }

  private later(ms: number, fn: () => void): void {
    this.timers.push(setTimeout(fn, ms));
  }

  private prefersReducedMotion(): boolean {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }
}
