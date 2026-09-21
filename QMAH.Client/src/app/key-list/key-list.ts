// key-list.ts
import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { KeyService } from '../services/key-service';
import { CatalogService } from '../services/catalog-service';
import { KeyExchangeRule, KeyModel, KeyFilter, UnlockWithKeyResult } from '../models/key-model';
import { keyAssetPath } from '../shared/key-assets';
import { LucideCircleCheckBig, LucideLibrary } from '@lucide/angular';

@Component({
  selector: 'app-key-list',
  standalone: true,
  imports: [CommonModule, LucideCircleCheckBig, LucideLibrary],
  templateUrl: './key-list.html',
  styleUrl: './key-list.scss',
})
export class KeyList implements OnInit {
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
  showAllSlots = signal(false);
  inspectedKey = signal<KeyModel | null>(null);
  exchangeRules = signal<KeyExchangeRule[]>([]);
  exchangeLoading = signal(false);
  exchangeError = signal('');
  exchangeNotice = signal('');

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

  /** 目前篩選範圍的啟用鑰匙種類數，只供「顯示完整格」模式決定視覺格數。 */
  availableSlotTypeCount = computed(() => {
    const filter = this.selectedFilter();
    return this.keys().filter((key) => filter === 'ALL' || key.scopeType === filter).length;
  });

  /** 預設只顯示持有中的鑰匙；切換完整格時才依目前種類補出空格。 */
  displaySlots = computed<(KeyModel | null)[]>(() => {
    if (!this.showAllSlots()) return this.filteredKeys();
    const filter = this.selectedFilter();
    return this.keys().filter(key => filter === 'ALL' || key.scopeType === filter);
  });

  trackByDisplaySlot(index: number, key: KeyModel | null): string {
    return key ? key.id : `empty-${index}`;
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
  private eraNameById = signal<Map<string, string>>(new Map());

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
        for (const category of categories) {
          map.set(category.id, category.name);
          map.set(category.code, category.name);
        }
        this.categoryNameById.set(map);
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

  toggleSlotMode(): void {
    this.showAllSlots.update((showAll) => !showAll);
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
        this.loadKeys();
        this.loadExchangeRules();
      },
      error: (err) => {
        this.exchangeLoading.set(false);
        this.exchangeError.set(err?.message ?? '兌換失敗，請稍後再試');
      },
    });
  }

  /** 每個篩選按鈕顯示的數字：這個範圍內「持有中」鑰匙的總持有數量加總 */
  getFilterCount(filter: KeyFilter): number {
    const keys = filter === 'ALL' ? this.ownedKeys() : this.ownedKeys().filter((key) => key.scopeType === filter);
    return keys.reduce((sum, key) => sum + key.balance, 0);
  }

  /** 附圖依檔名對應四種 scope；這裡只做前端呈現對照，不改後端鑰匙契約。 */
  keySlotIcon(key: KeyModel): string {
    return keyAssetPath(key.scopeType);
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

  /** 格子右下角的短標籤：不依賴 hover 也能辨識鑰匙用途。 */
  keyScopeShortLabel(key: KeyModel): string {
    switch (key.scopeType) {
      case 'CATEGORY':
        return this.getCategoryName(key.categoryId) || '分類';
      case 'ERA':
        return this.getEraName(key.eraBucketId) || '年代';
      case 'UNIVERSAL':
        return '萬能';
      case 'NORMAL':
      default:
        return '一般';
    }
  }

  /**
   * 萬能鑰匙不能從背包直接使用——依需求，萬能鑰匙是在圖鑑頁「尚未解鎖」的文物卡片上，
   * 點原有的解鎖按鈕時使用，玩家自己指定要解鎖哪一張卡片。背包這裡點萬能鑰匙格子
   * 不開確認視窗，只顯示一個提示。
   */
  onKeySlotClick(key: KeyModel): void {
    this.inspectedKey.set(key);
  }

  requestUnlock(key: KeyModel): void {
    if (key.scopeType === 'UNIVERSAL' || key.balance < 1 || key.eligibleArtifactCount < 1) return;
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
