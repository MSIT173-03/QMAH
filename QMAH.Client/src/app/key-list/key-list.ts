// key-list.ts
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  effect,
  signal,
  computed,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { KeyService } from '../services/key-service';
import { CatalogService } from '../services/catalog-service';
import { KeyModel, KeyFilter, UnlockWithKeyResult } from '../models/key-model';

@Component({
  selector: 'app-key-list',
  standalone: true,
  imports: [CommonModule],
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

  /** 背包只顯示「持有數量 > 0」的鑰匙；歸零後會自然從這個清單消失 */
  ownedKeys = computed(() => this.keys().filter((key) => key.balance > 0));

  /** 全部鑰匙的持有總數（不是種類數），右上角／篩選列都用這個算法 */
  totalKeyCount = computed(() => this.keys().reduce((sum, key) => sum + key.balance, 0));

  filteredKeys = computed<KeyModel[]>(() => {
    const filter = this.selectedFilter();
    if (filter === 'ALL') return this.ownedKeys();
    return this.ownedKeys().filter((key) => key.scopeType === filter);
  });

  /**
   * 固定格數的背包視覺：不管實際持有幾種鑰匙，格線看起來都像「本來就有這麼多格」，
   * 沒有的就是空格，之後拿到新鑰匙會自然填進空格裡——純粹是前端視覺呈現，
   * 不代表背包真的有容量上限；如果實際持有種類超過這個數字，全部照樣顯示，
   * 不會把真實資料裁掉，只有在筆數不足時才補空格。
   *
   * ⚠️ 這裡改回 viewChild()（signal 版查詢）＋ effect()：先前為了排除「新版 API
   * 相容性問題」的疑慮，改用 @ViewChild + ngAfterViewChecked + 手動呼叫
   * ChangeDetectorRef.detectChanges()／markForCheck()，結果證實那不是相容性問題——
   * 你的實測 log 顯示 detectChanges() 確實有執行、也沒有丟例外，但畫面／
   * ngAfterViewChecked 就是沒有真的因此再跑一次，代表「手動呼叫變更偵測 API」
   * 這條路徑，在這個專案的設定下並不可靠。
   * effect() 是 Angular 專門設計來處理「訊號變了、要連動跑副作用」這種情境的機制，
   * 跟框架自己的變更偵測排程是同一套底層機制，理論上不會有這種「呼叫了但沒反應」
   * 的落差。之前會從這個做法改走，是誤判——當時「格線只佔不到 1/3 高度」那個問題，
   * 後來查出來是 :host 沒設 height:100% 造成的，跟 effect()／viewChild() 本身無關，
   * 現在那個高度問題已經修好了，重新用回這個做法。
   *
   * gridGap／minSlotWidth 這兩個數字要跟 key-list.scss 的 .key-slot-grid
   * （gap: 12px；grid-template-columns: repeat(auto-fill, minmax(76px, 1fr))）保持一致，
   * 其中一邊改了記得同步改另一邊，不然算出來的格數會跟實際排版對不上。
   */
  private readonly gridGap = 12;
  private readonly minSlotWidth = 76;
  private readonly fallbackSlotCapacity = 24; // 量測還沒有結果之前（極短暫）的保底格數

  private slotGridRef = viewChild<ElementRef<HTMLElement>>('slotGrid');

  /** 量測出來的「完整列」格數；還沒量到之前先用 fallbackSlotCapacity 頂著 */
  visibleSlotCount = signal(this.fallbackSlotCapacity);

  /** null 代表空格 */
  displaySlots = computed<(KeyModel | null)[]>(() => {
    const keys = this.filteredKeys();
    // 真實資料一律完整顯示，不會被算出來的格數蓋掉——只有筆數不足時才補空格
    const capacity = Math.max(this.visibleSlotCount(), keys.length);
    const emptyCount = Math.max(0, capacity - keys.length);
    return [...keys, ...Array<null>(emptyCount).fill(null)];
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
  ) {
    // slotGridRef() 是 signal 版查詢：.key-slot-grid 這個元素只有在 !loading()
    // （資料載入完成）之後才會被 *ngIf 放進 DOM，這個 effect 不管它什麼時候出現
    // 都會偵測到、自動重新執行——這是 Angular 自己的響應式追蹤機制，不是我們手動
    // 排程或手動呼叫變更偵測 API，理論上不會有「呼叫了但沒反應」的落差。
    effect((onCleanup) => {
      const el = this.slotGridRef()?.nativeElement;
      console.log('[KeyList] effect 執行，slotGridRef 目前元素：', el ?? null); // ⚠️ 除錯用，確認畫面正常後可以刪掉
      if (!el) return;

      // 元素剛出現的當下就先算一次，不用等 ResizeObserver 自己的非同步初次回呼。
      this.recalculateVisibleSlotCount(el);

      // ResizeObserver 保留下來，只負責處理「之後」真正的尺寸變化（例如視窗縮放）。
      const observer = new ResizeObserver(() => this.recalculateVisibleSlotCount(el));
      observer.observe(el);
      onCleanup(() => observer.disconnect());
    });
  }

  /**
   * 量測 .key-slot-grid 容器目前的實際寬高，算出「剛好幾個完整列」（欄數 x 列數）。
   * 格子是正方形（key-list.scss 的 .key-slot 用 aspect-ratio:1/1），所以先用寬度、
   * gap 反推實際欄數與「每格實際邊長」，再用同一個邊長去算高度塞得下幾個完整列。
   */
  private recalculateVisibleSlotCount(el: HTMLElement): void {
    const width = el.clientWidth;
    const height = el.clientHeight;
    if (width <= 0 || height <= 0) return;

    const columns = Math.max(1, Math.floor((width + this.gridGap) / (this.minSlotWidth + this.gridGap)));
    const actualSlotSize = (width - (columns - 1) * this.gridGap) / columns;
    const rows = Math.max(1, Math.floor((height + this.gridGap) / (actualSlotSize + this.gridGap)));

    this.visibleSlotCount.set(columns * rows);
    console.log('[KeyList] 格數計算結果', { width, height, columns, rows, total: columns * rows }); // ⚠️ 除錯用，確認畫面正常後可以刪掉
  }

  ngOnInit(): void {
    console.log('[KeyList] ngOnInit 執行，開始呼叫 loadKeys()');
    this.loadKeys();
    this.loadCategoryEraNames();
  }

  private loadKeys(): void {
    this.loading.set(true);
    this.errorMsg.set('');

    this.keyService.getKeys().subscribe({
      next: (keys) => {
        console.log('[KeyList] getKeys() 的 next 執行了，收到', keys.length, '把鑰匙'); // ⚠️ 除錯用，確認畫面正常後可以刪掉
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

  /** 每個篩選按鈕顯示的數字：這個範圍內「持有中」鑰匙的總持有數量加總 */
  getFilterCount(filter: KeyFilter): number {
    const keys = filter === 'ALL' ? this.ownedKeys() : this.ownedKeys().filter((key) => key.scopeType === filter);
    return keys.reduce((sum, key) => sum + key.balance, 0);
  }

  /** 依鑰匙類型給一個對應的圖示，讓格子除了邊框顏色外，圖示本身也能一眼分辨種類（純前端外皮，跟 CompendiumSkin 的 emoji 是同一種做法） */
  /**
   * 依鑰匙類型決定格子要顯示的圖示。
   * 目前四種類型統一都先用 🔑，等你之後設計好每種類型專屬的 icon
   * （不管是換成不同 emoji，還是換成圖片路徑），**改這個方法裡對應的 case 就好**，
   * key-list.html 呼叫端（{{ keySlotIcon(k) }}）完全不用動。
   * key.scopeType 目前有四種：'NORMAL' | 'CATEGORY' | 'ERA' | 'UNIVERSAL'。
   */
  keySlotIcon(key: KeyModel): string {
    switch (key.scopeType) {
      case 'NORMAL': return '🔑';
      case 'CATEGORY': return '🔑';
      case 'ERA': return '🔑';
      case 'UNIVERSAL': return '🔑';
      default: return '🔑';
    }
  }

  /**
   * 萬能鑰匙不能從背包直接使用——依需求，萬能鑰匙是在圖鑑頁「尚未解鎖」的文物卡片上，
   * 點原有的解鎖按鈕時使用，玩家自己指定要解鎖哪一張卡片。背包這裡點萬能鑰匙格子
   * 不開確認視窗，只顯示一個提示。
   */
  onKeySlotClick(key: KeyModel): void {
    if (key.scopeType === 'UNIVERSAL') return;
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
