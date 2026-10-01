// key-list.ts
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { KeyService } from '../services/key-service';
import { CatalogService } from '../services/catalog-service';
import { KeyExchangeRule, KeyModel, KeyFilter, UnlockWithKeyResult } from '../models/key-model';
import { keyAssetPath } from '../shared/key-assets';
import { eraInitials } from '../shared/era-initials';
import { LucideCircleCheckBig, LucideLibrary } from '@lucide/angular';

@Component({
  selector: 'app-key-list',
  standalone: true,
  imports: [CommonModule, LucideCircleCheckBig, LucideLibrary],
  templateUrl: './key-list.html',
  styleUrl: './key-list.scss',
})
export class KeyList implements OnInit, OnDestroy {
  /**
   * 這個元件現在有兩種使用情境：
   * 1. 獨立頁面（例如從「會員」區塊點進來）：embedded 維持預設值 false，
   *    goToArtifact() 走原本的路由跳轉。
   * 2. 內嵌在圖鑑頁的彈出框裡（artifact-list.ts 點「鑰匙背包」按鈕開啟）：
   *    父層傳入 [embedded]="true"，goToArtifact() 改成 emit 事件讓父層自己處理
   *    「關掉背包、直接在同一頁聚焦那張卡片」，不再整頁導頁。
   */
  @Input() embedded = false;
  /** embedded 為 true 時，「前往查看」改 emit 這個事件，帶剛解鎖的 artifactId，父層負責關窗＋聚焦卡片 */
  @Output() artifactFocusRequested = new EventEmitter<string>();

  keys = signal<KeyModel[]>([]);
  loading = signal(true);
  errorMsg = signal('');

  selectedFilter = signal<KeyFilter>('ALL');
  exchangeRules = signal<KeyExchangeRule[]>([]);
  exchangeLoading = signal(false);
  exchangeError = signal('');
  exchangeNotice = signal('');

  // ---- 鑰匙合成台（取代原本的兌換規則卡片清單）----
  // 玩家把來源鑰匙放進合成台，放入的格子會依數量展開成多邊形（1 格、2 格左右、3 格三角形、
  // 4 格正方形……），中央是要兌換的目標鑰匙，右側是成品。不會一次列出所有兌換方式：
  // 只有「來源鑰匙與放入的一樣、sourceAmount 等於放入把數」的規則才會成為選項，
  // 選項超過一個時點中央開選單挑選。實際扣除與入帳仍走原本的 exchangeKeys()。

  /** 合成台最多可以展開的格數；超過的規則無法在多邊形上排開，改列在提示中 */
  readonly MAX_CRAFT_SLOTS = 12;
  /** 固定渲染 12 個格子元素，未使用的收在中央，這樣增減時才有展開／收合的位移動畫 */
  readonly craftSlotIndexes = Array.from({ length: this.MAX_CRAFT_SLOTS }, (_, i) => i);

  /** 已放入合成台的鑰匙 code，依放入順序排列；順序不影響兌換結果 */
  craftSlots = signal<string[]>([]);
  /** 玩家在中央選單選的兌換規則；null 代表用第一個選項 */
  selectedRuleId = signal<string | null>(null);
  craftDragOver = signal(false);
  /** 中央的兌換目標選單是否展開 */
  craftMenuOpen = signal(false);

  /** 能在合成台上排開的兌換規則 */
  craftableRules = computed(() =>
    this.exchangeRules().filter((rule) => rule.sourceAmount >= 1 && rule.sourceAmount <= this.MAX_CRAFT_SLOTS),
  );

  /** 需要超過合成台格數的規則數量，只做提示 */
  oversizedRuleCount = computed(() => this.exchangeRules().length - this.craftableRules().length);

  /** 合成台上方的材料欄：持有中、且至少是一條兌換規則來源的鑰匙 */
  craftSourceKeys = computed(() => {
    const codes = new Set(this.craftableRules().map((rule) => rule.sourceKeyCode));
    return this.ownedKeys().filter((key) => codes.has(key.code));
  });

  /** 合成台實際可放的上限 = 所有規則裡最大的 sourceAmount */
  craftMaxSlots = computed(() => Math.max(0, ...this.craftableRules().map((rule) => rule.sourceAmount)));

  /** 放了不只一種來源鑰匙；每次兌換只接受同一種來源 */
  craftMixed = computed(() => new Set(this.craftSlots()).size > 1);

  /** 合成台上全部是同一種鑰匙時的 code；空的或混放時為 null */
  craftSourceCode = computed(() => {
    const slots = this.craftSlots();
    return slots.length && !this.craftMixed() ? slots[0] : null;
  });

  /** 依放入的鑰匙決定的兌換選項：同一種來源、數量剛好 */
  craftOptions = computed(() => {
    const code = this.craftSourceCode();
    const count = this.craftSlots().length;
    return code ? this.craftableRules().filter((rule) => rule.sourceKeyCode === code && rule.sourceAmount === count) : [];
  });

  /** 同一種來源、還要再多放幾把才能兌換的規則，給提示用（依需要數量由少到多） */
  craftUpcoming = computed(() => {
    const code = this.craftSourceCode();
    const count = this.craftSlots().length;
    if (!code) return [];
    return this.craftableRules()
      .filter((rule) => rule.sourceKeyCode === code && rule.sourceAmount > count)
      .sort((a, b) => a.sourceAmount - b.sourceAmount);
  });

  craftSelectedRule = computed<KeyExchangeRule | null>(() => {
    const options = this.craftOptions();
    return options.find((rule) => rule.id === this.selectedRuleId()) ?? options[0] ?? null;
  });

  /** 選到的規則持有數也夠時，才會出現成品 */
  craftReadyRule = computed<KeyExchangeRule | null>(() => {
    const rule = this.craftSelectedRule();
    return rule && this.canExchange(rule) ? rule : null;
  });

  /**
   * 放入格與中央目標格一樣大（以合成台邊長的比例表示）。格子數多時自動縮小，
   * 讓整圈（半徑＋半格）留在合成台內；中央與四周之間刻意留大間距，參考寶石合成介面。
   */
  private craftGeometry = computed(() => {
    const count = this.craftSlots().length;
    const centerGap = 1.6; // 中央格與四周格的中心距離 = 1.6 格
    const neighborGap = 1.3; // 相鄰兩格的中心距離至少 1.3 格
    const factor = count > 2 ? Math.max(centerGap, neighborGap / (2 * Math.sin(Math.PI / count))) : centerGap;
    const size = Math.min(0.2, 0.48 / (factor + 0.5));
    return { count, size, radius: size * factor };
  });

  /** 放入格與中央格的邊長（百分比，綁在 [style.width.%]） */
  craftSlotSize = computed(() => this.craftGeometry().size * 100);

  /**
   * 多邊形頂點位置（百分比，不必量測 DOM）。
   * 奇數邊頂點朝上（三角形），偶數邊底邊水平（正方形、六邊形），1 格在上方，2 格左右排。
   */
  craftSlotPositions = computed(() => {
    const { count, radius } = this.craftGeometry();
    if (!count) return [];
    if (count === 1) return [{ x: 50, y: 50 - radius * 100 }];
    const start = -Math.PI / 2 + (count % 2 === 0 ? Math.PI / count : 0);
    return Array.from({ length: count }, (_, i) => {
      const angle = start + (i * 2 * Math.PI) / count;
      return { x: 50 + radius * 100 * Math.cos(angle), y: 50 + radius * 100 * Math.sin(angle) };
    });
  });

  /** 多邊形外框（SVG viewBox 0 0 100 100）；1 格時畫一條連向中央的線 */
  craftOutlinePoints = computed(() => {
    const points = this.craftSlotPositions();
    if (points.length === 1) return `${points[0].x},${points[0].y} 50,50`;
    return points.map((point) => `${point.x},${point.y}`).join(' ');
  });

  /** 右側成品下方第一行：兌換狀態 */
  craftHint = computed(() => {
    const count = this.craftSlots().length;
    const rule = this.craftSelectedRule();
    if (this.exchangeLoading()) return '處理中…';
    if (!count) return ''; // 尚未放入時的引導文字改放在左側放入區下方（craftMenuHint）
    if (this.craftMixed()) return '一次只能放入同一種鑰匙';
    if (rule && !this.canExchange(rule)) return `持有的${rule.sourceKeyName}不足 ${rule.sourceAmount} 把`;
    if (rule) return '點擊成品兌換 1 組';
    const next = this.craftUpcoming()[0];
    if (next) return `再放入 ${next.sourceAmount - count} 把，可兌換${next.targetKeyName}`;
    return '這個數量沒有兌換方式，請取回幾把';
  });

  /** 右側成品下方第二行：可以兌換時才顯示「幾把換幾把」 */
  craftHintDetail = computed(() => {
    const rule = this.craftReadyRule();
    if (!rule || this.exchangeLoading()) return '';
    return `${rule.sourceAmount} 把${rule.sourceKeyName}兌換 ${rule.targetAmount} 把${rule.targetKeyName}`;
  });

  /** 中央目標格的提示框操作說明 */
  craftCenterTipHint = computed(() => (this.craftOptions().length > 1 ? '點擊選擇其他兌換目標' : '兌換目標'));

  /**
   * 左側放入區下方：還沒放入時引導玩家放鑰匙；有多個兌換目標時提示可以點中央挑選。
   */
  craftMenuHint = computed(() => {
    if (!this.craftSlots().length) return '從上方點選或拖曳鑰匙放入合成台';
    const count = this.craftOptions().length;
    return count > 1 ? `點中央可從 ${count} 種中選擇` : '';
  });

  // ---- 物品詳細資訊提示框：跟著游標出現在物品旁邊（取代原本固定在底部的資訊條）----
  // 整頁只有一個提示框，以 fixed 定位擺在游標或格子旁，並夾在 .key-page 的可見範圍內，
  // 獨立頁面與內嵌彈出框都不會被邊緣裁掉。

  @ViewChild('pageRoot', { static: true }) private pageRoot?: ElementRef<HTMLElement>;
  @ViewChild('keyTooltip') private keyTooltipEl?: ElementRef<HTMLElement>;

  /** 目前提示的鑰匙，以及操作提示（依格子位置不同：點擊使用／放入／取回／兌換） */
  tooltip = signal<{ key: KeyModel; hint: string; owner: HTMLElement } | null>(null);
  /** 定位完成前先隱藏，避免提示框在左上角閃一下 */
  tooltipPos = signal<{ left: number; top: number } | null>(null);
  /** 游標或觸控起點；鍵盤聚焦時為 null，改以格子本身為定位基準 */
  private tooltipPointer: { x: number; y: number } | null = null;
  private tooltipFrame = 0;
  private tooltipTimer: ReturnType<typeof setTimeout> | undefined;

  /** 背包只顯示「持有數量 > 0」的鑰匙；歸零後會自然從這個清單消失 */
  ownedKeys = computed(() => this.keys().filter((key) => key.balance > 0));

  /** 全部鑰匙的持有總數（不是種類數），右上角／篩選列都用這個算法 */
  totalKeyCount = computed(() => this.keys().reduce((sum, key) => sum + key.balance, 0));

  /** 目前持有中的鑰匙種類數，與總把數分開呈現，避免玩家把兩者混為一談。 */
  ownedKeyTypeCount = computed(() => this.ownedKeys().length);

  filteredKeys = computed<KeyModel[]>(() => {
    const filter = this.selectedFilter();
    if (filter === 'ALL') return this.ownedKeys();
    return this.ownedKeys().filter((key) => key.scopeType === filter);
  });

  trackByKeyId(_index: number, key: KeyModel): string {
    return key.id;
  }

  // ---- 使用鑰匙：點格子 → 確認視窗 → 呼叫解鎖 API → 結果視窗 ----
  /** 準備使用的鑰匙（點擊後、按下確定使用前）；null 代表確認視窗關閉 */
  confirmTarget = signal<KeyModel | null>(null);
  /** 解鎖 API 執行中，用來讓「確定使用」按鈕顯示 loading、避免重複點擊 */
  unlocking = signal(false);
  /** 解鎖成功後的結果，給「解鎖了什麼文物」的提示視窗用；null 代表視窗關閉 */
  unlockResult = signal<UnlockWithKeyResult | null>(null);
  unlockError = signal('');

  // integration: 後端目前對一般、年代與分類鑰匙的解鎖交易固定扣 1 把；
  // 兌換規則 API 是另一個未在本頁使用的資料契約，不能把它誤當成解鎖成本。
  confirmCost = computed(() => {
    const key = this.confirmTarget();
    return key ? 1 : 0;
  });

  /** 持有數量是否不夠這次解鎖要消耗的數量（規則載入完成前一律當作 1 把，通常足夠） */
  confirmInsufficient = computed(() => {
    const key = this.confirmTarget();
    return key ? key.balance < this.confirmCost() : false;
  });

  // 分類／年代對照表：改用專門的 /api/v1/catalog/categories、/api/v1/catalog/eras
  // 這兩支 API 建立，取代原本「掃一頁文物清單湊對照表」的權宜做法。
  //
  // ⚠️ 這裡改用 signal<Map<...>> 而不是一般的 private Map 屬性：一般的 Map 屬性
  // 在 HTTP 回應回來後用 .set() 直接原地修改，Angular 不會知道要重新檢查畫面
  // （尤其是 zoneless change detection 的情況——這應該就是「懸停一直顯示 ID、
  // 但完全沒有跳出任何警告」的真正原因：對照表其實有抓到資料，只是畫面沒有
  // 被通知要重新渲染）。改成 signal 後，每次都整包塞一個新的 Map 進去，
  // 才能確實觸發畫面更新。
  private categoryNameById = signal<Map<string, string>>(new Map());
  private categoryCodeById = signal<Map<string, string>>(new Map());
  private eraNameById = signal<Map<string, string>>(new Map());

  /**
   * 年代鑰匙的字首（鑰匙圖本身不變，字疊在鑰匙前方的左上角）。
   * 依全部年代名稱一起算，字首重複的才會取兩個字，例如日本大正 → 日大。
   */
  private eraInitialsByName = computed(() => eraInitials([...new Set(this.eraNameById().values())]));

  constructor(
    private keyService: KeyService,
    private catalogService: CatalogService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    // console.log('[KeyList] ngOnInit 執行，開始呼叫 loadKeys()');
    this.loadKeys();
    this.loadCategoryEraNames();
    this.loadExchangeRules();
  }

  private loadExchangeRules(): void {
    this.keyService.getExchangeRules().subscribe({
      next: (rules) => this.exchangeRules.set(rules.filter((rule) => rule.id && rule.sourceKeyCode && rule.targetKeyCode)),
      error: (err) => this.exchangeError.set(err?.message ?? '兌換規則暫時無法讀取'),
    });
  }

  private loadKeys(): void {
    this.loading.set(true);
    this.errorMsg.set('');

    this.keyService.getKeys().subscribe({
      next: (keys) => {
        // console.log('[KeyList] getKeys() 的 next 執行了，收到', keys.length, '把鑰匙');
        this.keys.set(keys);
        this.clampCraftSlots();
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMsg.set(err?.message ?? '讀取鑰匙資料失敗');
        this.loading.set(false);
      },
    });
  }

  /**
   * ⚠️ 防呆：目前不確定 KeyModel.categoryId／eraBucketId 存的到底是 CategoryModel.id
   * 還是 CategoryModel.code，兩個都拿來當 key 建對照表，不管鑰匙那邊存的是哪一種
   * 都查得到名稱。等確認實際存的是哪一種之後，可以只留其中一行。
   */
  private loadCategoryEraNames(): void {
    this.catalogService.getCategories().subscribe({
      next: (categories) => {
        const map = new Map<string, string>();
        const codes = new Map<string, string>();
        for (const category of categories) {
          map.set(category.id, category.name);
          map.set(category.code, category.name);
          codes.set(category.id, category.code);
          codes.set(category.code, category.code);
        }
        this.categoryNameById.set(map);
        this.categoryCodeById.set(codes);
      },
      error: (err) => console.error('[KeyList] loadCategoryEraNames (categories) failed', err),
    });

    this.catalogService.getEras().subscribe({
      next: (eras) => {
        const map = new Map<string, string>();
        for (const era of eras) {
          map.set(era.id, era.name);
          map.set(era.code, era.name);
        }
        this.eraNameById.set(map);
      },
      error: (err) => console.error('[KeyList] loadCategoryEraNames (eras) failed', err),
    });
  }

  /** 依 categoryId 查對應的分類顯示名稱；查不到就退回顯示原始 ID，不留空白 */
  getCategoryName(categoryId: string | null): string {
    if (!categoryId) return '';
    return this.categoryNameById().get(categoryId) ?? categoryId;
  }

  /** 依 eraBucketId 查對應的年代顯示名稱；查不到就退回顯示原始 ID */
  getEraName(eraBucketId: string | null): string {
    if (!eraBucketId) return '';
    return this.eraNameById().get(eraBucketId) ?? eraBucketId;
  }

  setFilter(filter: KeyFilter): void {
    this.selectedFilter.set(filter);
  }

  exchangeRulesFor(key: KeyModel): KeyExchangeRule[] {
    return this.exchangeRules().filter((rule) => rule.sourceKeyCode === key.code);
  }

  canExchange(rule: KeyExchangeRule): boolean {
    return (this.ownedKeys().find((key) => key.code === rule.sourceKeyCode)?.balance ?? 0) >= rule.sourceAmount;
  }

  exchange(rule: KeyExchangeRule): void {
    if (this.exchangeLoading() || !this.canExchange(rule)) return;
    this.exchangeLoading.set(true);
    this.exchangeError.set('');
    this.exchangeNotice.set('');
    this.keyService.exchangeKeys(rule.id).subscribe({
      next: (result) => {
        this.exchangeLoading.set(false);
        this.exchangeNotice.set(`已兌換 ${result.sourceAmount} 把鑰匙，取得 ${result.targetAmount} 把${rule.targetKeyName}。`);
        this.clearCraft();
        this.loadKeys();
        this.loadExchangeRules();
      },
      error: (err) => {
        this.exchangeLoading.set(false);
        this.exchangeError.set(err?.message ?? '兌換失敗，請稍後再試');
      },
    });
  }

  // ---- 鑰匙合成台操作 ----

  /** 未使用的格子收在合成台中央（50%, 50%） */
  craftSlotPos(index: number): { x: number; y: number } {
    return this.craftSlotPositions()[index] ?? { x: 50, y: 50 };
  }

  /** 這把鑰匙扣掉已放進合成台的數量後，還能再放幾把 */
  craftRemaining(key: KeyModel): number {
    return key.balance - this.craftSlots().filter((code) => code === key.code).length;
  }

  canAddToCraft(key: KeyModel): boolean {
    return !this.exchangeLoading() && this.craftSlots().length < this.craftMaxSlots() && this.craftRemaining(key) > 0;
  }

  addToCraft(key: KeyModel): void {
    if (!this.canAddToCraft(key)) return;
    this.exchangeNotice.set('');
    this.exchangeError.set('');
    this.craftSlots.update((slots) => [...slots, key.code]);
    this.afterCraftChange();
  }

  removeFromCraft(index: number): void {
    if (this.exchangeLoading()) return;
    this.craftSlots.update((slots) => slots.filter((_, i) => i !== index));
    this.afterCraftChange();
  }

  clearCraft(): void {
    this.craftSlots.set([]);
    this.selectedRuleId.set(null);
    this.craftMenuOpen.set(false);
  }

  /** 中央只有一個選項時沒有選單可開，直接顯示那個目標 */
  toggleCraftMenu(): void {
    if (this.craftOptions().length < 2) return;
    const open = !this.craftMenuOpen();
    this.craftMenuOpen.set(open);
    this.hideKeyTip();
    if (open) {
      // 開啟後把焦點移到目前選中的項目，鍵盤可以直接上下左右挑選
      requestAnimationFrame(() =>
        this.pageRoot?.nativeElement.querySelector<HTMLElement>('.craft-menu__item[aria-checked="true"]')?.focus(),
      );
    }
  }

  selectCraftRule(rule: KeyExchangeRule): void {
    this.selectedRuleId.set(rule.id);
    this.closeCraftMenu(true);
  }

  closeCraftMenu(restoreFocus = false): void {
    if (!this.craftMenuOpen()) return;
    this.craftMenuOpen.set(false);
    this.hideKeyTip();
    if (restoreFocus) this.pageRoot?.nativeElement.querySelector<HTMLElement>('.craft-center')?.focus();
  }

  /** 選單內用方向鍵移動、Esc 關閉 */
  onCraftMenuKeydown(event: KeyboardEvent): void {
    const items = Array.from(
      this.pageRoot?.nativeElement.querySelectorAll<HTMLElement>('.craft-menu__item') ?? [],
    );
    const index = items.indexOf(document.activeElement as HTMLElement);
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (step && items.length) {
      event.preventDefault();
      items[(index + step + items.length) % items.length].focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.closeCraftMenu(true);
    } else if (event.key === 'Tab') {
      this.closeCraftMenu();
    }
  }

  /** 點選單以外的地方就收起來 */
  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (!this.craftMenuOpen()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.craft-menu, .craft-center')) return;
    this.closeCraftMenu();
  }

  craftOutput(): void {
    const rule = this.craftReadyRule();
    if (rule) this.exchange(rule);
  }

  /** 放入的鑰匙改變後收起選單；目前的選擇若已不在選項內，交給 craftSelectedRule 退回第一個 */
  private afterCraftChange(): void {
    this.craftMenuOpen.set(false);
    if (!this.craftOptions().some((rule) => rule.id === this.selectedRuleId())) this.selectedRuleId.set(null);
  }

  /** 重新讀取持有數量後，拿掉合成台上超出目前持有數的鑰匙 */
  private clampCraftSlots(): void {
    const used = new Map<string, number>();
    const balanceOf = (code: string) => this.keys().find((key) => key.code === code)?.balance ?? 0;
    const next = this.craftSlots().filter((code) => {
      const count = (used.get(code) ?? 0) + 1;
      used.set(code, count);
      return count <= balanceOf(code);
    });
    if (next.length !== this.craftSlots().length) {
      this.craftSlots.set(next);
      this.afterCraftChange();
    }
  }

  onCraftDragStart(event: DragEvent, key: KeyModel): void {
    this.hideKeyTip();
    event.dataTransfer?.setData('text/plain', key.code);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
  }

  onCraftDragOver(event: DragEvent): void {
    event.preventDefault();
    this.craftDragOver.set(true);
  }

  onCraftDrop(event: DragEvent): void {
    event.preventDefault();
    this.craftDragOver.set(false);
    const code = event.dataTransfer?.getData('text/plain');
    const key = this.ownedKeys().find((item) => item.code === code);
    if (key) this.addToCraft(key);
  }

  // ---- 物品詳細資訊提示框 ----

  /** 滑鼠移入：出現在游標右下方 */
  showKeyTip(event: PointerEvent, key: KeyModel | undefined, hint: string): void {
    if (!key || event.pointerType !== 'mouse' || this.craftMenuOpenFor(event)) return;
    this.tooltipPointer = { x: event.clientX, y: event.clientY };
    this.openKeyTip(key, hint, event.currentTarget as HTMLElement);
  }

  /** 滑鼠在同一格內移動時跟著游標走 */
  moveKeyTip(event: PointerEvent): void {
    const tip = this.tooltip();
    if (!tip || event.pointerType !== 'mouse' || tip.owner !== event.currentTarget) return;
    this.tooltipPointer = { x: event.clientX, y: event.clientY };
    this.scheduleTooltipPosition();
  }

  /**
   * 按下時：滑鼠點擊先收起提示（跟系統提示框一樣，點了就消失）；
   * 觸控沒有 hover，改成點一下後在格子旁顯示 2 秒。
   */
  pressKeyTip(event: PointerEvent, key: KeyModel | undefined, hint: string): void {
    if (event.pointerType === 'mouse') {
      this.hideKeyTip();
      return;
    }
    if (!key) return;
    this.tooltipPointer = null;
    this.openKeyTip(key, hint, event.currentTarget as HTMLElement);
    this.tooltipTimer = setTimeout(() => this.hideKeyTip(), 2000);
  }

  /** 只有鍵盤聚焦（:focus-visible）才顯示，滑鼠點擊造成的聚焦不重複跳出 */
  focusKeyTip(event: FocusEvent, key: KeyModel | undefined, hint: string): void {
    const owner = event.currentTarget as HTMLElement;
    if (!key || !owner.matches(':focus-visible')) return;
    this.tooltipPointer = null;
    this.openKeyTip(key, hint, owner);
  }

  /** 背包格的操作提示：萬能鑰匙不能從背包使用 */
  bagTipHint(key: KeyModel): string {
    if (key.scopeType === 'UNIVERSAL') return '請至圖鑑頁的文物卡片上使用';
    return key.eligibleArtifactCount > 0 ? '點擊使用' : '目前沒有可解鎖的文物';
  }

  hideKeyTip(): void {
    clearTimeout(this.tooltipTimer);
    cancelAnimationFrame(this.tooltipFrame);
    this.tooltip.set(null);
    this.tooltipPos.set(null);
  }

  /** 捲動時提示框會跟格子脫節，直接收起 */
  @HostListener('window:scroll')
  @HostListener('window:resize')
  onViewportChange(): void {
    if (this.tooltip()) this.hideKeyTip();
  }

  ngOnDestroy(): void {
    this.hideKeyTip();
  }

  private craftMenuOpenFor(event: Event): boolean {
    return this.craftMenuOpen() && !(event.currentTarget as HTMLElement).closest('.craft-menu');
  }

  private openKeyTip(key: KeyModel, hint: string, owner: HTMLElement): void {
    clearTimeout(this.tooltipTimer);
    const current = this.tooltip();
    if (current?.key.id !== key.id || current.hint !== hint || current.owner !== owner) {
      this.tooltip.set({ key, hint, owner });
      this.tooltipPos.set(null);
    }
    this.scheduleTooltipPosition();
  }

  /** 等提示框渲染出來量到實際大小後再定位 */
  private scheduleTooltipPosition(): void {
    cancelAnimationFrame(this.tooltipFrame);
    this.tooltipFrame = requestAnimationFrame(() => this.positionKeyTip());
  }

  /**
   * 提示框用 position: fixed，以畫面座標計算：優先放在游標（或格子）的右下方，
   * 下方放不下就翻到上方，並夾在 .key-page 的可見範圍內（內嵌時就是彈出框本身）。
   *
   * ⚠️ 內嵌模式的彈出框（.key-bag-stage）若有 transform，fixed 的定位基準會變成彈出框
   * 而不是整個畫面。所以不直接相信 left/top：先量提示框「實際」出現在哪裡，算出定位基準
   * 的偏移再扣回去，兩種情況都能對準。提示框本身不能加 transform，否則這個量法會失準。
   */
  private positionKeyTip(): void {
    const tip = this.tooltip();
    const page = this.pageRoot?.nativeElement;
    const el = this.keyTooltipEl?.nativeElement;
    if (!tip || !page || !el) return;
    if (!tip.owner.isConnected) {
      this.hideKeyTip();
      return;
    }

    const current = this.tooltipPos() ?? { left: 0, top: 0 };
    const rendered = el.getBoundingClientRect();
    const originX = rendered.left - current.left;
    const originY = rendered.top - current.top;
    const width = rendered.width;
    const height = rendered.height;
    const margin = 8;

    let left: number;
    let below: number;
    let above: number;
    if (this.tooltipPointer) {
      left = this.tooltipPointer.x + 12;
      below = this.tooltipPointer.y + 20;
      above = this.tooltipPointer.y - height - 10;
    } else {
      const rect = tip.owner.getBoundingClientRect();
      left = rect.left;
      below = rect.bottom + 6;
      above = rect.top - height - 6;
    }

    const pageRect = page.getBoundingClientRect();
    const minX = Math.max(pageRect.left, 0) + margin;
    const maxX = Math.min(pageRect.right, window.innerWidth) - width - margin;
    const minY = Math.max(pageRect.top, 0) + margin;
    const maxY = Math.min(pageRect.bottom, window.innerHeight) - height - margin;

    const x = Math.max(minX, Math.min(left, maxX));
    const y = below <= maxY ? below : Math.max(minY, above);
    this.tooltipPos.set({ left: x - originX, top: y - originY });
  }

  /** 兌換目標可能還沒持有（balance 0），所以從完整的 keys() 找，而不是 ownedKeys() */
  keyByCode(code: string): KeyModel | undefined {
    return this.keys().find((key) => key.code === code);
  }

  keyIconByCode(code: string): string {
    const key = this.keyByCode(code);
    return key ? this.keySlotIcon(key) : keyAssetPath('NORMAL');
  }

  keyNameByCode(code: string): string {
    return this.keyByCode(code)?.name ?? code;
  }

  keyScopeByCode(code: string): KeyModel['scopeType'] {
    return this.keyByCode(code)?.scopeType ?? 'NORMAL';
  }

  /**
   * 年代鑰匙格左上角要顯示的字首（拆成單字陣列，模板逐字輸出）。
   * 不是年代鑰匙、或年代對照表還沒載入時回傳 null，不顯示字首。
   */
  eraMark(key: KeyModel | undefined): string[] | null {
    if (key?.scopeType !== 'ERA' || !key.eraBucketId) return null;
    const name = this.eraNameById().get(key.eraBucketId);
    const initials = name ? this.eraInitialsByName().get(name) : undefined;
    return initials ? [...initials] : null;
  }

  eraMarkByCode(code: string): string[] | null {
    return this.eraMark(this.keyByCode(code));
  }

  /** 每個篩選按鈕顯示的數字：這個範圍內「持有中」鑰匙的總持有數量加總 */
  getFilterCount(filter: KeyFilter): number {
    const keys = filter === 'ALL' ? this.ownedKeys() : this.ownedKeys().filter((key) => key.scopeType === filter);
    return keys.reduce((sum, key) => sum + key.balance, 0);
  }

  /** 分類鑰匙依分類名稱或代碼顯示材質圖示，沿用既有後端鑰匙資料。 */
  keySlotIcon(key: KeyModel): string {
    const categoryCode = key.categoryId ? this.categoryCodeById().get(key.categoryId) : undefined;
    return keyAssetPath(
      key.scopeType,
      categoryCode ?? `${this.getCategoryName(key.categoryId)} ${key.categoryId ?? ''} ${key.code} ${key.name}`,
    );
  }

  /**
   * ui-integration: 背包格與會員資產頁共用玩家語意；保留 scopeType 作為資料判斷，
   * 只在畫面補上「探索／分類／年代／萬能」的用途說明。
   */
  keyScopeLabel(scopeType: KeyModel['scopeType']): string {
    return {
      NORMAL: '探索鑰匙',
      CATEGORY: '分類鑰匙',
      ERA: '年代鑰匙',
      UNIVERSAL: '萬能鑰匙',
    }[scopeType];
  }

  keyScopeDescription(scopeType: KeyModel['scopeType']): string {
    return {
      NORMAL: '從尚未解鎖的文物中探索一件',
      CATEGORY: '從指定分類探索一件文物',
      ERA: '從指定年代探索一件文物',
      UNIVERSAL: '由你指定一件文物解鎖',
    }[scopeType];
  }

  /**
   * 萬能鑰匙不能從背包直接使用——依需求，萬能鑰匙是在圖鑑頁「尚未解鎖」的文物卡片上，
   * 點原有的解鎖按鈕時使用，玩家自己指定要解鎖哪一張卡片。背包這裡點萬能鑰匙格子
   * 不開確認視窗，只顯示一個提示（見 tooltip）。
   * 其他鑰匙點格子直接開啟使用確認視窗，不需要先看檢視面板再按解鎖。
   */
  onKeySlotClick(key: KeyModel): void {
    if (key.scopeType === 'UNIVERSAL' || key.balance < 1 || key.eligibleArtifactCount < 1) return;
    this.hideKeyTip();
    this.unlockError.set('');
    this.confirmTarget.set(key);
  }

  cancelUseKey(): void {
    this.confirmTarget.set(null);
  }

  onConfirmOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cancelUseKey();
    }
  }

  /**
   * 確定使用一般／年代／分類鑰匙：不用帶 artifactId，後端依這把鑰匙的特性
   * （scopeType 是 NORMAL／ERA／CATEGORY）自行從尚未解鎖的文物裡隨機挑一個
   * （不會挑到已解鎖或重複的文物）。成功後關掉確認視窗、開「解鎖了什麼文物」的結果視窗。
   */
  confirmUseKey(): void {
    const key = this.confirmTarget();
    if (!key || this.unlocking()) return;
    if (this.confirmInsufficient()) return;

    this.unlocking.set(true);
    this.unlockError.set('');

    this.keyService.unlockWithKey(key.code).subscribe({
      next: (result) => {
        // 後端回應沒有 remainingBalance（鑰匙剩餘數量），改成重新打 getKeys() 拿
        // 最新、正確的持有數量，不要自己在前端用猜的方式扣減。
        this.loadKeys();
        this.unlocking.set(false);

        // ⚠️「這把鑰匙目前沒有符合條件的未解鎖文物」這個情境，後端是回 HTTP 200 +
        // unlocked: false（不會扣鑰匙），不是錯誤狀態碼，所以不能只看 HTTP 有沒有
        // 成功就當作解鎖了——要另外檢查 result.unlocked，沒解鎖時把 message 顯示出來，
        // 並讓確認視窗繼續開著（不開「解鎖成功」的結果視窗）。
        if (result.unlocked) {
          this.confirmTarget.set(null);
          this.unlockResult.set(result);
        } else {
          this.unlockError.set(result.message ?? '目前沒有符合條件的文物可以解鎖。');
        }
      },
      error: (err) => {
        this.unlocking.set(false);
        this.unlockError.set(err?.message ?? '解鎖失敗，請稍後再試');
      },
    });
  }

  closeUnlockResult(): void {
    this.unlockResult.set(null);
  }

  onResultOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeUnlockResult();
    }
  }

  /**
   * 「是否跳轉至該文物頁面」：
   * - embedded=false（獨立頁面）：導去圖鑑頁，並帶上 ?focus=<artifactId>，讓那邊載入完
   *   清單後自動開啟放大檢視、聚焦在剛解鎖的那張卡片上（對應 artifact-list.ts 的
   *   focusFromQueryParamIfAny()）。
   * - embedded=true（內嵌在圖鑑頁的彈出框裡）：不整頁導頁——本來就已經在圖鑑頁上了，
   *   改成 emit artifactFocusRequested，父層會自己關掉背包彈窗、直接聚焦那張卡片。
   *
   * ⚠️ 路由路徑 '/' 是假設值，還沒跟你的 routes 設定確認過，如果圖鑑頁實際路徑
   * 不是根路徑，這裡要跟著改（只影響 embedded=false 這個分支）。
   */
  goToArtifact(): void {
    const result = this.unlockResult();
    if (!result || !result.artifactId) return;
    this.unlockResult.set(null);

    if (this.embedded) {
      this.artifactFocusRequested.emit(result.artifactId);
      return;
    }

    // integration: 圖鑑正式入口是 /artifact-list，避免解鎖完成後導向空白根路由。
    this.router.navigate(['/artifact-list'], { queryParams: { focus: result.artifactId } });
  }
}
