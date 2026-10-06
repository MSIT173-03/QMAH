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
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
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
import { QmahIconComponent, type QmahIconName } from '../shared/components/qmah-icon/qmah-icon';

const CATEGORY_ICONS: Readonly<Record<string, QmahIconName>> = {
  銅器: 'cooking-pot',
  陶瓷: 'amphora',
  玉器: 'gem',
  琺瑯器: 'flower-2',
  漆器: 'box',
  錢幣: 'coins',
  雕刻: 'shapes',
  繪畫: 'brush',
};

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
  /** 每排最少張數 */
  minCols: 4,
  minCardW: 130,
  /** 卡片名稱列（含與圖框的間距）高度 */
  labelH: 26,
  /** 圖框高度 = 卡片寬 × 這個比例 */
  frameRatio: 0.86,
  /** 分區標題高度（含下方間距） */
  headerH: 36,
  /** 書頁高度的安全餘量，避免小數點進位讓最後一列被裁掉 */
  slack: 6,
} as const;

/**
 * 年代的內建對照（西元，西元前為負數；endYear 空缺＝迄今用 9999）。
 * 後端 /catalog/eras 沒回、還沒回或缺某個年代時用它，排序與篩選單的年份都不會亂。
 * 內容與 QMAH.Infrastructure 的 era-buckets.json 一致。
 */
const OPEN_END = 9999;
export const ERA_FALLBACK: ReadonlyArray<{ code: string; name: string; start: number; end: number }> = [
  { code: 'NEOLITHIC', name: '新石器時代', start: -10000, end: -2000 },
  { code: 'YANGSHAO', name: '仰韶文化', start: -5000, end: -3000 },
  { code: 'HONGSHAN', name: '紅山文化', start: -4700, end: -2900 },
  { code: 'LIANGZHU', name: '良渚文化', start: -3300, end: -2300 },
  { code: 'SHANG', name: '商', start: -1600, end: -1046 },
  { code: 'ZHOU', name: '周', start: -1046, end: -256 },
  { code: 'SPRING_AUTUMN', name: '春秋', start: -770, end: -476 },
  { code: 'WARRING_STATES', name: '戰國', start: -475, end: -221 },
  { code: 'QIN', name: '秦', start: -221, end: -206 },
  { code: 'HAN', name: '漢', start: -206, end: 220 },
  { code: 'THREE_KINGDOMS', name: '三國', start: 220, end: 280 },
  { code: 'NORTH_SOUTH', name: '南北朝', start: 420, end: 589 },
  { code: 'SUI', name: '隋', start: 581, end: 618 },
  { code: 'TANG', name: '唐', start: 618, end: 907 },
  { code: 'FIVE_DYNASTIES', name: '五代十國', start: 907, end: 960 },
  { code: 'LIAO', name: '遼', start: 916, end: 1125 },
  { code: 'SONG', name: '宋', start: 960, end: 1279 },
  { code: 'WESTERN_XIA', name: '西夏', start: 1038, end: 1227 },
  { code: 'JIN', name: '金', start: 1115, end: 1234 },
  { code: 'YUAN', name: '元', start: 1271, end: 1368 },
  { code: 'MING', name: '明', start: 1368, end: 1644 },
  { code: 'QING', name: '清', start: 1644, end: 1912 },
  { code: 'JAPAN_EDO', name: '日本江戶時代', start: 1603, end: 1868 },
  { code: 'JAPAN_MEIJI', name: '日本明治時代', start: 1868, end: 1912 },
  { code: 'REPUBLIC', name: '中華民國', start: 1912, end: OPEN_END },
  { code: 'JAPAN_TAISHO', name: '日本大正時代', start: 1912, end: 1926 },
  { code: 'JAPAN_SHOWA', name: '日本昭和時代', start: 1926, end: 1989 },
  { code: 'PRC', name: '中華人民共和國', start: 1949, end: OPEN_END },
  { code: 'JAPAN_HEISEI', name: '日本平成時代', start: 1989, end: 2019 },
  { code: 'JAPAN_REIWA', name: '日本令和時代', start: 2019, end: OPEN_END },
];

function buildFallbackEraOrder(): Map<string, { start: number; end: number }> {
  const map = new Map<string, { start: number; end: number }>();
  for (const era of ERA_FALLBACK) {
    map.set(era.code, { start: era.start, end: era.end });
    map.set(era.name, { start: era.start, end: era.end });
  }
  return map;
}

/** 年代先後排序用：先比起年、再比迄年（迄今排最後）、沒有年代資料的排到最後 */
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
 * 計算單頁可以放幾欄、卡片多大。寬度再小也維持四欄（卡片跟著縮小），避免小螢幕只剩一兩張卡。
 */
export function computeCatalogLayout(width: number, height: number): CatalogLayout | null {
  if (width <= 0 || height <= 0) return null;
  const { gap, minCardW, labelH, frameRatio } = BOOK_LAYOUT;
  // 無論視窗放大或縮小，一排至少四張；寬度夠才會更多
  const cols = Math.max(BOOK_LAYOUT.minCols, Math.floor((width + gap) / (minCardW + gap)));
  const bodyH = Math.floor(height) - BOOK_LAYOUT.slack;
  let cardW = Math.floor((width - gap * (cols - 1)) / cols);
  // 標題＋一列卡片一定要放得進一頁，否則那一列會被書頁裁掉、文物像憑空消失
  const maxCardH = bodyH - BOOK_LAYOUT.headerH - gap;
  const maxCardW = Math.floor((maxCardH - labelH) / frameRatio);
  cardW = Math.min(cardW, Math.max(maxCardW, 72));
  const cardH = Math.round(cardW * frameRatio) + labelH;
  return { cols, cardW, cardH, rowH: cardH + gap, bodyH };
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
  imports: [CommonModule, FormsModule, KeyList, ArtifactDiscussionDialog, QmahIconComponent],
  templateUrl: './artifact-list.html',
  // 封面、書本、彈出視窗的樣式拆成三個檔案，避免單一樣式檔超過 angular.json 的 32kB 預算；
  // 封面要放在最前面，artifact-list.scss 裡的窄螢幕規則才能覆寫它。
  styleUrls: ['./artifact-list.cover.scss', './artifact-list.scss', './artifact-list.filters.scss', './artifact-list.dialogs.scss'],
})
export class ArtifactList implements OnInit, AfterViewInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  @ViewChild('artifactPage', { static: true }) private artifactPage?: ElementRef<HTMLElement>;
  readonly fullscreenSupported = !!this.document.fullscreenEnabled;
  readonly isFullscreen = signal(false);
  readonly fullscreenBusy = signal(false);
  readonly fullscreenError = signal('');

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
  private firstSpreadPreloaded = false;

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
  private eraOrder = signal<Map<string, { start: number; end: number }>>(buildFallbackEraOrder());

  /**
   * 年代籤的顏色依「時代區間」分成九個礦物／植物顏料色（石青灰、青銅、朱砂、赭石、石綠、天青、靛、胭脂、墨），
   * 日本各時代統一用藤紫。分界點取各時代的起始年：
   *   < -2000 史前　< -475 商周春秋　< 220 戰國秦漢　< 618 三國至隋　< 907 唐
   *   < 1271 五代宋遼金　< 1644 元明　< 1868 清　之後 近現代
   */
  eraTone(era: string): string {
    if (era.startsWith('日本')) return 'plum';
    const start = this.eraOrder().get(era)?.start;
    if (start == null) return 'stone';
    if (start < -2000) return 'slate';
    if (start < -475) return 'bronze';
    if (start < 220) return 'cinnabar';
    if (start < 618) return 'ochre';
    if (start < 907) return 'jade';
    if (start < 1271) return 'celadon';
    if (start < 1644) return 'indigo';
    if (start < 1868) return 'rouge';
    return 'sumi';
  }

  /**
   * 分類的顏色：八個分類各自一個獨立的顏料色，不重複（漆器朱紅、陶瓷青瓷、玉器青玉、琺瑯胭脂、
   * 繪畫靛藍、銅器赭銅、錢幣黃銅、雕刻石青灰）。分類籤、文物卡的角框、文物詳情頁都用同一組。
   * 沒列到的新分類退回石青灰。
   */
  categoryTone(category: string): string {
    if (/漆/.test(category)) return 'cinnabar';
    if (/陶|瓷|磚|瓦/.test(category)) return 'celadon';
    if (/玉/.test(category)) return 'jade';
    if (/琺瑯/.test(category)) return 'rouge';
    if (/畫|書|紙|帖|絹|織|繡/.test(category)) return 'indigo';
    if (/幣/.test(category)) return 'bronze';
    if (/銅|金|銀|錫|鐵/.test(category)) return 'ochre';
    return 'slate';
  }

  /** 文物卡與詳情頁的顏色：依目前的檢視方式——用「分類」時是分類色，其餘（年代／全部）是年代色，兩處永遠同一色系 */
  cardTone(item: { eraName: string; categoryName: string }): string {
    return this.catalogTab() === 'CATEGORY' ? this.categoryTone(item.categoryName) : this.eraTone(item.eraName);
  }

  categoryGlyph(category: string): string {
    if (/琺瑯/.test(category)) return 'rouge';
    if (/銅|金|銀|錫|鐵/.test(category)) return 'bronze';
    if (/幣/.test(category)) return 'coin';
    if (/陶|瓷|磚|瓦/.test(category)) return 'clay';
    if (/漆/.test(category)) return 'lacquer';
    if (/玉/.test(category)) return 'jade';
    if (/畫|書|紙|帖|絹|織|繡/.test(category)) return 'painting';
    if (/雕|刻|佛|像/.test(category)) return 'carving';
    return 'stone';
  }

  /** 年代篩選條上的年份註記，例如「前1046–前256」「1912–迄今」 */
  eraYears(era: string): string {
    const span = this.eraOrder().get(era);
    if (!span) return '';
    const fmt = (y: number) => (y < 0 ? `前${-y}` : `${y}`);
    return `${fmt(span.start)}–${span.end >= OPEN_END ? '迄今' : fmt(span.end)}`;
  }

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

  categoryIcon(category: string): QmahIconName {
    return CATEGORY_ICONS[category] ?? 'shapes';
  }

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
  ) {
    // 書頁大小是畫面能不能排出文物的唯一依據：ResizeObserver 之外，書本狀態／分頁／資料就緒時也主動量一次，
    // 避免觀察器漏報（例如元件熱更新、書本從收合到攤開）造成 pageBox 一直是 0、整本書空白
    effect(() => {
      this.bookState();
      this.bookSection();
      this.catalogViewReady();
      this.measureSoon();
    });
    // 圖鑑資料一就緒就預先載入第一個跨頁（兩頁）的照片：翻開書的過程中第一頁已經完整呈現，不會一張張補上
    effect(() => {
      if (!this.catalogViewReady() || this.firstSpreadPreloaded) return;
      const pages = this.pages();
      const fromPages = pages.slice(0, 2).flatMap((page) => page.lines.flatMap((line) => (line.kind === 'row' ? line.items : [])));
      const items = fromPages.length ? fromPages : (this.catalogGroups()[0]?.items.slice(0, 16) ?? []);
      if (!items.length) return;
      this.firstSpreadPreloaded = true;
      for (const item of items) {
        if (!item.thumbnailPath) continue;
        const img = new Image();
        img.decoding = 'async';
        img.src = this.getImageUrl(item.thumbnailPath);
      }
    });
  }

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
    this.measurePage();
    this.measureSoon();
    const el = this.pageMeasure?.nativeElement;
    if (!el || typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.zone.run(() => this.measurePage()));
    this.resizeObserver.observe(el);
  }

  /** 量一次書頁內容區的實際大小；大小沒變就不動，避免多餘的重排 */
  private measurePage(): void {
    const el = this.pageMeasure?.nativeElement;
    if (!el) return;
    const w = Math.floor(el.clientWidth);
    const h = Math.floor(el.clientHeight);
    const current = this.pageBox();
    if (current.w !== w || current.h !== h) this.pageBox.set({ w, h });
  }

  /** 下一個畫面與書本翻開動畫結束後各補量一次 */
  private measureSoon(): void {
    for (const delay of [0, 120, 1250]) {
      this.timers.push(setTimeout(() => this.measurePage(), delay));
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.measurePage();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.timers.forEach((timer) => clearTimeout(timer));
  }

  // ================= 書本：開闔、頁籤、翻頁 =================

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    this.isFullscreen.set(this.document.fullscreenElement === this.artifactPage?.nativeElement);
    this.fullscreenError.set('');
  }

  async toggleFullscreen(): Promise<void> {
    const page = this.artifactPage?.nativeElement;
    if (!page || !this.fullscreenSupported || this.fullscreenBusy()) return;
    this.fullscreenBusy.set(true);
    this.fullscreenError.set('');
    try {
      if (this.document.fullscreenElement === page) {
        await this.document.exitFullscreen();
      } else {
        await page.requestFullscreen();
      }
      this.onFullscreenChange();
    } catch {
      this.fullscreenError.set('無法切換全螢幕，請再試一次。');
    } finally {
      this.fullscreenBusy.set(false);
    }
  }

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
    if (this.isFullscreen()) void this.toggleFullscreen();
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
    // 先把底下的頁面換成新的（被翻開的那一側立刻露出新內容），再讓書頁翻過去
    this.turnFrom.set(this.currentSpread());
    this.turning.set(dir > 0 ? 'next' : 'prev');
    this.spread.set(target);
    this.later(720, () => this.turning.set(null));
  }

  /** 翻頁動畫開始時的跨頁索引 */
  turnFrom = signal(0);

  private pageAt(index: number): CatalogPage | null {
    return this.pages()[index] ?? null;
  }
  private leftIndex(spread: number): number {
    return spread * 2;
  }
  private rightIndex(spread: number): number {
    return this.filterMode() ? spread : spread * 2 + 1;
  }

  /** 翻頁的書頁落在哪一側：往後翻＝右半繞書脊翻到左；往前翻＝左半翻到右。篩選單開著時左頁是篩選單，一律從右半翻出 */
  leafSide = computed<'next' | 'prev' | null>(() => (this.turning() ? (this.filterMode() ? 'next' : this.turning()) : null));

  /** 書頁正面（翻走的那一頁）與背面（翻過來的那一頁）的內容 */
  leafFront = computed<CatalogPage | null>(() => {
    const t = this.turning();
    if (!t) return null;
    const from = this.turnFrom();
    return t === 'prev' && !this.filterMode() ? this.pageAt(this.leftIndex(from)) : this.pageAt(this.rightIndex(from));
  });
  leafBack = computed<CatalogPage | null>(() => {
    const t = this.turning();
    if (!t || this.filterMode()) return null;
    const to = this.currentSpread();
    return t === 'next' ? this.pageAt(this.leftIndex(to)) : this.pageAt(this.rightIndex(to));
  });

  /** 翻頁期間兩頁各自顯示的內容：被書頁蓋住的那一側維持舊內容，翻開的那一側已經是新內容 */
  shownLeft = computed<CatalogPage | null>(() =>
    this.turning() === 'next' && !this.filterMode() ? this.pageAt(this.leftIndex(this.turnFrom())) : this.leftPage(),
  );
  shownRight = computed<CatalogPage | null>(() =>
    this.turning() === 'prev' && !this.filterMode() ? this.pageAt(this.rightIndex(this.turnFrom())) : this.rightPage(),
  );

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
        // 以內建對照為底，後端有回的年代再覆蓋；endYear 為空代表迄今
        const order = buildFallbackEraOrder();
        for (const era of eras) {
          const start = Number(era.startYear);
          if (era.startYear == null || !Number.isFinite(start)) continue;
          const end = era.endYear == null ? OPEN_END : Number(era.endYear);
          const span = { start, end: Number.isFinite(end) ? end : OPEN_END };
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

  /**
   * 放大檢視：點到任何「透明處」都要能離開——背景、卡片與按鈕之間的空隙、資料頁外的留白都算。
   * 只有點在實體內容（放大圖卡片、資料頁、按鈕、連結、輸入框）上才不關閉。
   */
  onOverlayClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    const solid = target?.closest?.('.focus-card, .info-panel__inner, .focus-actions .action-btn, .hint, a, button, input, textarea, select');
    if (!solid) this.closeOverlay();
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
