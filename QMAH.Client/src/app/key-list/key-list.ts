// key-list.ts
import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { KeyService } from '../services/key-service';
import { CatalogService } from '../services/catalog-service';
import { KeyModel, KeyFilter, KeyExchangeRule, UnlockWithKeyResult, costForScope } from '../models/key-model';

@Component({
  selector: 'app-key-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './key-list.html',
  styleUrl: './key-list.scss',
})
export class KeyList implements OnInit {
  keys = signal<KeyModel[]>([]);
  loading = signal(true);
  errorMsg = signal('');

  selectedFilter = signal<KeyFilter>('ALL');

  /** 背包只顯示「持有數量 > 0」的鑰匙；歸零後會自然從這個清單消失 */
  ownedKeys = computed(() => this.keys().filter((key) => key.balance > 0));

  /** 全部鑰匙的持有總數（不是種類數），右上角／篩選列都用這個算法 */
  totalKeyCount = computed(() => this.keys().reduce((sum, key) => sum + key.balance, 0));

  isEmpty = computed(() => !this.loading() && !this.errorMsg() && this.filteredKeys().length === 0);

  filteredKeys = computed<KeyModel[]>(() => {
    const filter = this.selectedFilter();
    if (filter === 'ALL') return this.ownedKeys();
    return this.ownedKeys().filter((key) => key.scopeType === filter);
  });

  // ---- 使用鑰匙：點格子 → 確認視窗 → 呼叫解鎖 API → 結果視窗 ----
  /** 準備使用的鑰匙（點擊後、按下確定使用前）；null 代表確認視窗關閉 */
  confirmTarget = signal<KeyModel | null>(null);
  /** 解鎖 API 執行中，用來讓「確定使用」按鈕顯示 loading、避免重複點擊 */
  unlocking = signal(false);
  /** 解鎖成功後的結果，給「解鎖了什麼文物」的提示視窗用；null 代表視窗關閉 */
  unlockResult = signal<UnlockWithKeyResult | null>(null);
  unlockError = signal('');

  /** GET /me/keys/exchange-rules 回來的解鎖規則：每種鑰匙解鎖一次要消耗幾把 */
  exchangeRules = signal<KeyExchangeRule[]>([]);

  /** 目前準備使用的鑰匙，依它的 scopeType 從 exchangeRules 查出的實際消耗數量（查不到 fallback 為 1） */
  confirmCost = computed(() => {
    const key = this.confirmTarget();
    return key ? costForScope(this.exchangeRules(), key.scopeType) : 0;
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
  ) { }

  ngOnInit(): void {
    this.loadKeys();
    this.loadCategoryEraNames();
    this.loadExchangeRules();
  }

  private loadKeys(): void {
    this.loading.set(true);
    this.errorMsg.set('');

    this.keyService.getKeys().subscribe({
      next: (keys) => {
        this.keys.set(keys);
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMsg.set(err?.message ?? '讀取鑰匙資料失敗');
        this.loading.set(false);
      },
    });
  }

  /** 載入解鎖規則，讓確認視窗能顯示「這把鑰匙實際要消耗幾把」，而不是永遠假設 1 把 */
  private loadExchangeRules(): void {
    this.keyService.getExchangeRules().subscribe({
      next: (rules) => this.exchangeRules.set(rules),
      error: (err) => console.error('[KeyList] loadExchangeRules failed', err),
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

  trackByKeyId(_index: number, key: KeyModel): string {
    return key.id;
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
   * 「是否跳轉至該文物頁面」：導去圖鑑頁，並帶上 ?focus=<artifactId>，
   * 讓那邊載入完清單後自動開啟放大檢視、聚焦在剛解鎖的那張卡片上
   * （對應 artifact-list.ts 的 focusFromQueryParamIfAny()）。
   *
   * ⚠️ 路由路徑 '/' 是假設值，還沒跟你的 routes 設定確認過，如果圖鑑頁實際路徑
   * 不是根路徑，這裡要跟著改。
   */
  goToArtifact(): void {
    const result = this.unlockResult();
    if (!result) return;
    this.router.navigate(['/'], { queryParams: { focus: result.artifactId } });
    this.unlockResult.set(null);
  }
}
