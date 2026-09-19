// artifact-list.ts
import { Component, EventEmitter, Output, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, of, switchMap } from 'rxjs';
import { CatalogService } from '../services/catalog-service';
import { CatalogModel, CatalogDetailModel } from '../models/catalog-model';
import { ArtifactUnlockRecord, CardEntry, CompendiumSkin, CompendiumCardSummary } from '../models/artifact-unlock-model';
import { KeyService } from '../services/key-service';
import { KeyModel } from '../models/key-model';
// ⚠️ 路徑是假設值：假設 key-list.ts 跟 artifact-list.ts 是同一層目錄下的兄弟資料夾
// （例如都在 components/ 底下），如果實際檔案結構不同，這行要跟著改。
import { KeyList } from '../key-list/key-list';

/** 依年代分組後的顯示用結構（格狀列表只需要清單卡片，不含鑑賞細節） */
interface EraGroup {
  eraName: string;
  items: CompendiumCardSummary[];
}

@Component({
  selector: 'app-artifact-list',
  standalone: true,
  imports: [CommonModule, FormsModule, KeyList],
  templateUrl: './artifact-list.html',
  styleUrl: './artifact-list.scss'
})
export class ArtifactList implements OnInit {
  // ---- 文物清單 ----
  // ⚠️ 版面改成「依年代分區、每區可展開全部」之後，畫面需要看到「全部」文物才能正確分組、
  // 正確搜尋，不能只看某一頁的 12 筆，所以這裡不再是分頁抓取，而是把後端全部分頁串接起來，
  // 一次載入完整清單。catalogModel 現在存放的是「全部」文物，不是單一頁。
  //
  // 型別是 CompendiumCardSummary 而不是 CardEntry：格狀列表只需要清單欄位＋外皮＋解鎖狀態，
  // 不需要 description / sizeText / primaryImagePath 這類鑑賞細節——那些欄位只在使用者
  // 點開某張卡片時才透過 CatalogService.getArtifactById() 即時抓取（見下方 focusedDetail 相關程式碼），
  // 避免一次把整批文物的細節資料都打回來。
  catalogModel = signal<CompendiumCardSummary[]>([]);
  loading = signal(true);
  errorMsg = signal('');
  totalCount = signal(0);

  // integration: 原分支留下文物新增／編輯表單的狀態，但目前圖鑑頁沒有掛載該表單或管理 API。
  // 先保留註解而不讓它進入執行路徑，避免使用者誤以為前台已提供未完成的管理功能；
  // 後續若要做管理介面，應改放到 Admin route 並補齊權限與 API 後再恢復。
  // showForm = signal(false);
  // editingArtifact = signal<CatalogModel | null>(null);

  // ---- 圖鑑放大檢視／解鎖（原 artifact-unlock.ts 併入）----
  keys = signal(0); // 全部鑰匙的持有總數，頭部徽章用
  /** 萬能鑰匙（如果有的話）；圖鑑頁卡片上的解鎖按鈕固定用這把，不是背包那邊的一般/年代/分類鑰匙 */
  universalKey = signal<KeyModel | null>(null);
  // integration: 後端目前的 UnlockArtifactAsync 固定扣除 1 把鑰匙；
  // /me/keys/exchange-rules 是鑰匙兌換規則，不是解鎖成本，不能拿來猜畫面數字。
  unlockKeyCost = computed(() => 1);
  /** 現在改由 GET /me/catalog/artifact/unlocks 載入真實流水，見 loadUnlockStatus() */
  unlockLedger = signal<ArtifactUnlockRecord[]>([]);
  /** 解鎖確認視窗要顯示的錯誤／提示訊息（HTTP 失敗或後端 unlocked:false 時使用） */
  unlockError = signal('');
  unlockedCount = computed(() => this.catalogModel().filter((i) => i.unlocked).length);

  focusedId = signal<string | null>(null);
  infoOpen = signal(false);
  confirmTargetId = signal<string | null>(null);
  ledgerOpen = signal(false);

  // ---- 目前放大檢視中卡片的鑑賞細節（description / sizeText / primaryImagePath...）----
  // 只有已解鎖的卡片才需要載入，見 maybeLoadFocusedDetail()。
  focusedDetail = signal<CatalogDetailModel | null>(null);
  focusedDetailLoading = signal(false);
  focusedDetailError = signal('');

  // integration: 原分支的「全部解鎖」Debug 開關沒有正式 UI，也不應改寫真實解鎖狀態。
  // 先註解保留除錯脈絡；正式測試應使用測試資料或 API mock，不把測試捷徑帶進部署程式。
  // debugAllUnlocked = signal(false);
  // private debugUnlockBackup: Map<string, boolean> | null = null;

  // ---- 搜尋／篩選 ----
  searchQuery = signal('');
  /** 年代／分類改成核取方塊多選，空集合代表「不篩選（全部）」 */
  selectedEras = signal<Set<string>>(new Set());
  selectedCategories = signal<Set<string>>(new Set());

  /** 篩選用的年代核取方塊選項，來自「全部」文物（不受目前篩選影響），解鎖／未解鎖都算 */
  eraOptions = computed(() => {
    const names = new Set(this.catalogModel().map((i) => i.eraName));
    return Array.from(names).sort();
  });

  /** 篩選用的分類核取方塊選項，同上 */
  categoryOptions = computed(() => {
    const names = new Set(this.catalogModel().map((i) => i.categoryName));
    return Array.from(names).sort();
  });

  toggleEraFilter(era: string): void {
    this.selectedEras.update((set) => {
      const next = new Set(set);
      if (next.has(era)) next.delete(era); else next.add(era);
      return next;
    });
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
  }

  isCategorySelected(category: string): boolean {
    return this.selectedCategories().has(category);
  }

  /** 清除搜尋關鍵字＋年代／分類篩選，一次全部恢復成「顯示全部」 */
  clearFilters(): void {
    this.searchQuery.set('');
    this.selectedEras.set(new Set());
    this.selectedCategories.set(new Set());
  }

  /**
   * 套用搜尋框關鍵字 + 年代／分類核取方塊後的結果。
   * 年代／分類各自是「複選、勾了哪些就顯示哪些」（同一組內是 OR），
   * 兩組之間再取交集（AND）；都沒勾任何選項時視為不篩選（顯示全部）。
   * 關鍵字比對：編號／年代／分類一律可比對；「名字」只比對已解鎖的文物
   * （未解鎖的文物名稱是遊戲機制上的「？？？」謎底，不應該被關鍵字搜出來）。
   * 年代／分類核取方塊本身不分解鎖狀態，兩種文物都會篩到。
   */
  filteredItems = computed<CompendiumCardSummary[]>(() => {
    const keyword = this.searchQuery().trim().toLowerCase();
    const eras = this.selectedEras();
    const categories = this.selectedCategories();

    return this.catalogModel().filter((item) => {
      if (eras.size > 0 && !eras.has(item.eraName)) return false;
      if (categories.size > 0 && !categories.has(item.categoryName)) return false;
      if (!keyword) return true;

      const matchesRef = item.artifactRef.toLowerCase().includes(keyword);
      const matchesEra = item.eraName.toLowerCase().includes(keyword);
      const matchesCategory = item.categoryName.toLowerCase().includes(keyword);
      const matchesName = item.unlocked && item.name.toLowerCase().includes(keyword);

      return matchesRef || matchesEra || matchesCategory || matchesName;
    });
  });

  /**
   * 依年代分區，區內再依分類排序（相同分類排在一起）。
   * 年代區塊排序：預設用「該年代文物數量」由多到少排——因為 categoryCode／eraCode
   * 不足以推斷正確的朝代先後順序（要正確按朝代先後排，需要一份完整的朝代對照表，
   * 這裡沒有現成資料可用，先用數量排序頂替；如果你有現成的朝代排序規則，
   * 告訴我我再把排序依據換掉）。
   */
  eraGroups = computed<EraGroup[]>(() => {
    const groups = new Map<string, CompendiumCardSummary[]>();

    for (const item of this.filteredItems()) {
      const list = groups.get(item.eraName) ?? [];
      list.push(item);
      groups.set(item.eraName, list);
    }

    return Array.from(groups.entries())
      .map(([eraName, items]) => ({
        eraName,
        items: [...items].sort((a, b) => a.categoryCode.localeCompare(b.categoryCode)),
      }))
      .sort((a, b) => b.items.length - a.items.length);
  });

  /** 涵蓋兩種情況：後端本來就沒有資料、或搜尋／篩選條件下沒有任何符合的文物 */
  isEmpty = computed(() => !this.loading() && !this.errorMsg() && this.eraGroups().length === 0);

  /** 每個年代區塊預設只展開的（未點「更多文物+」的）數量 */
  private readonly previewCount = 4;

  /** 已展開「顯示全部」的年代名稱集合 */
  expandedEras = signal<Set<string>>(new Set());

  isEraExpanded(eraName: string): boolean {
    return this.expandedEras().has(eraName);
  }

  toggleEraExpand(eraName: string): void {
    this.expandedEras.update((set) => {
      const next = new Set(set);
      if (next.has(eraName)) {
        next.delete(eraName);
      } else {
        next.add(eraName);
      }
      return next;
    });
  }

  /** 這個年代區塊目前要顯示的文物（預覽 4 筆或全部） */
  visibleItemsForEra(group: EraGroup): CompendiumCardSummary[] {
    return this.isEraExpanded(group.eraName) ? group.items : group.items.slice(0, this.previewCount);
  }

  trackByEraName(_index: number, group: EraGroup): string {
    return group.eraName;
  }

  /** 讓外部（父層路由）接手「玩家回答鑑賞」的導頁邏輯，避免元件直接耦合 Router */
  @Output() appreciationRequested = new EventEmitter<CardEntry>();

  // integration: 原分支留下未使用且綁死 localhost 的圖片 URL；正式圖片路徑應由 API／Media resolver 提供。
  // private baseImageUrl = 'https://localhost:7249/api/v1/me/catalog/artifacts';

  constructor(
    private catalogService: CatalogService,
    private keyService: KeyService,
    private router: Router,
    private route: ActivatedRoute,
  ) { }

  ngOnInit(): void {
    this.loadArtifacts();
    this.loadKeyBalance();
  }

  loadArtifacts(): void {
    this.loading.set(true);
    this.errorMsg.set('');

    this.fetchAllPages(1, []).subscribe({
      next: (models) => {
        this.catalogModel.set(models.map((model) => this.toCardSummary(model)));
        this.totalCount.set(models.length);
        this.loading.set(false);
        this.focusFromQueryParamIfAny();
        this.loadUnlockStatus();
      },
      error: (err) => {
        this.errorMsg.set(err.message);
        this.loading.set(false);
      },
    });
  }

  /**
   * 文物清單載入完成後，再打 GET /me/catalog/artifact/unlocks 補上真實解鎖狀態，
   * 取代 toCardSummary() 裡 unlocked: false 的佔位假資料。
   *
   * 同時把這份流水拿來取代原本「本次連線期間由 API 回應累積」的除錯用 unlockLedger——
   * 右下角的解鎖流水面板改成顯示這支 API 回傳的真實歷史紀錄，不再只是 debug 假資料；
   * 之後玩家在畫面上實際解鎖（confirmUnlock()）時，才繼續即時 append 新的一筆上去。
   */
  private loadUnlockStatus(): void {
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
      },
      error: (err) => console.error('[ArtifactList] loadUnlockStatus failed', err),
    });
  }

  /**
   * 從 key-list 解鎖成功後跳轉過來時，會帶 ?focus=<artifactId> 這個 query param，
   * 清單載入完成後如果有這個 id 就直接開啟放大檢視、聚焦在那張卡片上。
   *
   * ⚠️ 這裡假設本頁路由路徑是 '/'——之前 onKeyBagClick() 導去 key-list 用的是
   * '/key-list'，這裡對稱地假設本頁是 '/'，實際上兩個路徑都還沒跟你的 routes
   * 設定確認過。如果不對，這裡跟 key-list.ts 的 goToArtifact() 要一起改。
   */
  private focusFromQueryParamIfAny(): void {
    const focusId = this.route.snapshot.queryParamMap.get('focus');
    if (focusId && this.catalogModel().some((i) => i.id === focusId)) {
      this.openCard(focusId);
    }
  }

  /**
   * 依序把後端所有分頁抓完、合併成單一陣列。
   * ⚠️ 如果文物總數很大（例如上千筆），每次都全部抓回來效能不理想；
   * 比較好的長期方案是後端直接提供一支「已依年代分組」的專用 API，
   * 這裡先用現有的 getArtifacts() 分頁 API 湊出同樣效果。
   */
  private fetchAllPages(page: number, acc: CatalogModel[]): Observable<CatalogModel[]> {
    const bulkPageSize = 100;
    return this.catalogService.getArtifacts(page, bulkPageSize).pipe(
      switchMap((res) => {
        const combined = [...acc, ...res.items];
        return page < res.totalPages ? this.fetchAllPages(page + 1, combined) : of(combined);
      })
    );
  }

  /**
   * 右上角顯示的鑰匙數是「全部鑰匙的持有數量總和」；同時把萬能鑰匙（如果有）另外存起來，
   * 圖鑑頁卡片上的解鎖按鈕固定要用這把鑰匙，不是背包那邊任何一把一般/年代/分類鑰匙。
   */
  private loadKeyBalance(): void {
    this.keyService.getKeys().subscribe({
      next: (allKeys) => {
        this.keys.set(allKeys.reduce((sum, key) => sum + key.balance, 0));
        this.universalKey.set(allKeys.find((key) => key.scopeType === 'UNIVERSAL') ?? null);
      },
      error: (err) => console.error('[ArtifactList] loadKeyBalance failed', err),
    });
  }

  /**
   * 後端目前還沒有「圖鑑遊戲外皮」的對應欄位或 API（純前端遊戲機制），
   * 這裡先用暫時的預設值把 CatalogModel 補成 CompendiumCardSummary。
   *
   * 文物本身的鑑賞細節（description / sizeText / primaryImagePath...）不在這裡用假資料頂著——
   * GET /catalog/artifacts/{id} 已經是真正可用的 API 了，所以改成點開卡片時才用
   * CatalogService.getArtifactById() 即時抓真資料（見 maybeLoadFocusedDetail()），不需要、也不該用假資料。
   *
   * unlocked／unlockedAt 這裡一律先給預設的「未解鎖」，實際狀態由 loadUnlockStatus()
   * 打 GET /me/catalog/artifact/unlocks 回來後再覆寫（見 loadArtifacts() 內的呼叫順序）。
   */
  private toCardSummary(model: CatalogModel): CompendiumCardSummary {
    const placeholderSkin: CompendiumSkin = {
      emoji: '🖼️',
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

  // integration: 以下 CRUD 表單 handler 沒有任何模板呼叫者；保留原始意圖但先停用，
  // 避免未完成的 Catalog 管理流程與目前唯讀／解鎖前台混在同一個元件。
  // onAddClick(): void {
  //   this.editingArtifact.set(null);
  //   this.showForm.set(true);
  // }
  //
  // onEditClick(catalogModel: CatalogModel): void {
  //   this.editingArtifact.set(catalogModel);
  //   this.showForm.set(true);
  // }
  //
  // onFormSaved(): void {
  //   this.showForm.set(false);
  //   this.loadArtifacts();
  // }
  //
  // onFormCancelled(): void {
  //   this.showForm.set(false);
  // }

  trackByArtifactId(_index: number, item: CompendiumCardSummary): string {
    return item.id;
  }

  // ========== 以下為原 artifact-unlock.ts 的放大檢視／解鎖邏輯 ==========

  focusedItem = computed<CompendiumCardSummary | null>(() => {
    const id = this.focusedId();
    if (id === null) return null;
    return this.catalogModel().find((i) => i.id === id) ?? null;
  });

  /**
   * 目前放大檢視卡片的「完整」資料：清單卡片＋已載入的鑑賞細節。
   * 只有在細節已經抓回來、且 id 對得上目前聚焦的卡片時才會有值，
   * 提供給資訊面板顯示、放大圖、以及「玩家回答鑑賞」導頁使用。
   */
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

  ledgerDescending = computed(() => [...this.unlockLedger()].reverse());

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

  /** 放大檢視要顯示的圖片：已解鎖且細節已載入時用正式展示圖，否則沿用清單縮圖（維持「？？？」神秘感） */
  focusedImagePath(item: CompendiumCardSummary): string {
    return this.focusedCardEntry()?.primaryImagePath ?? item.thumbnailPath;
  }

  /**
   * 只有「已解鎖」的卡片才需要載入完整鑑賞細節，未解鎖的卡片畫面上只會顯示縮圖跟「？？？」，
   * 不需要先把細節資料抓回來。同一張卡片如果已經有細節了就不重抓。
   */
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

  openUnlockConfirm(id: string): void {
    this.unlockError.set('');
    this.confirmTargetId.set(id);
  }

  cancelUnlockConfirm(): void {
    this.confirmTargetId.set(null);
    this.unlockError.set('');
  }

  /**
   * 圖鑑頁卡片上的解鎖按鈕固定使用萬能鑰匙（不是背包裡任何一般/年代/分類鑰匙），
   * 呼叫 KeyService.unlockWithKey() 並帶上 artifactId 指定要解鎖哪一張卡片。
   *
   * ⚠️ 後端實際回應（ArtifactUnlockResultDto）只有 unlocked／artifactId／artifactName／
   * remainingEligibleArtifactCount／message，沒有完整流水紀錄，也沒有鑰匙剩餘數量，
   * 所以這裡不從回應裡讀鑰匙餘額或流水，改成成功後重新呼叫 loadKeyBalance()／
   * loadUnlockStatus() 跟後端要正確資料；unlockedAt 先用前端當下時間點近似。
   */
  confirmUnlock(): void {
    const target = this.confirmTarget();
    if (!target) return;
    if (this.confirmInsufficient()) return;

    const universal = this.universalKey();
    if (!universal) return; // 沒有萬能鑰匙時按鈕本來就該是停用狀態，這裡再擋一次

    this.unlockError.set('');

    this.keyService.unlockWithKey(universal.code, target.id).subscribe({
      next: (result) => {
        // 鑰匙餘額改重新呼叫 loadKeyBalance() 問後端要正確數字，不用 unlockKeyCost()
        // 在前端自己相減去猜。
        this.loadKeyBalance();

        // ⚠️「這把鑰匙目前沒有符合條件的未解鎖文物」這個情境，後端是回 HTTP 200 +
        // unlocked: false（不會扣鑰匙），不是錯誤狀態碼，所以不能只看 HTTP 有沒有
        // 成功就當作解鎖了——要另外檢查 result.unlocked，沒解鎖時把 message 顯示在
        // 確認視窗裡，並讓視窗繼續開著，不去更新 catalogModel 的解鎖狀態。
        if (!result.unlocked) {
          this.unlockError.set(result.message ?? '目前沒有符合條件的文物可以解鎖。');
          return;
        }

        // unlockedAt 先用前端當下時間點近似，等 loadUnlockStatus() 打
        // GET /me/catalog/artifact/unlocks 成功後，會再用後端真實時間覆寫回來。
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
        // TODO: 依專案慣例改成 Toast / Snackbar 提示
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

  onAppreciationClick(item: CardEntry): void {
    this.appreciationRequested.emit(item);
  }

  /**
   * 返回會員頁面。
   * ⚠️ 路由路徑 '/member' 是假設值，還沒跟你的 routes 設定確認過，
   * 如果會員頁實際路徑不同，這裡要跟著改。
   */
  goBackToMember(): void {
    this.router.navigate(['/member']);
  }

  /** 鑰匙背包彈出框是否開啟；不再導頁到另一個頁面，直接在同一畫面上開一個放大框 */
  keyBagOpen = signal(false);

  onKeyBagClick(): void {
    this.keyBagOpen.set(true);
  }

  /**
   * 關閉鑰匙背包彈出框。玩家在裡面可能用掉了鑰匙、解鎖了文物，關閉時重新拿一次
   * 鑰匙餘額跟解鎖狀態，不管他在裡面實際做了什麼操作，圖鑑頁資料都會是最新的
   * ——不用逐一去追蹤彈出框裡發生的每個動作。
   */
  closeKeyBag(): void {
    this.keyBagOpen.set(false);
    this.loadKeyBalance();
    this.loadUnlockStatus();
  }

  onKeyBagOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeKeyBag();
    }
  }

  /**
   * 鑰匙背包彈出框裡按「前往查看」（KeyList embedded 模式 emit 出來的事件）：
   * 關掉背包彈出框，直接在同一頁聚焦剛解鎖的那張卡片，不整頁導頁。
   */
  onArtifactFocusRequestedFromKeyBag(artifactId: string): void {
    this.closeKeyBag();

    // 樂觀地先把這張卡標成已解鎖：loadUnlockStatus() 是非同步的，如果還沒回來
    // 就直接呼叫 openCard()，卡片可能會先短暫呈現「未解鎖」再跳成已解鎖，
    // 這裡先手動標記避免那個閃爍；loadUnlockStatus() 完成後會再用後端真實資料覆寫回來。
    this.catalogModel.update((list) =>
      list.map((i) =>
        i.id === artifactId ? { ...i, unlocked: true, unlockedAt: i.unlockedAt ?? new Date().toISOString() } : i
      )
    );
    this.openCard(artifactId);
  }

  toggleLedger(): void {
    this.ledgerOpen.update((v) => !v);
  }

  // integration: 原分支的全解鎖 Debug handler 沒有模板入口，且會在前端偽造會員解鎖狀態。
  // 先註解而不刪除，避免測試脈絡遺失；若未來需要使用，應移到 development-only 測試頁。
  // toggleDebugUnlockAll(): void {
  //   if (this.debugAllUnlocked()) {
  //     const backup = this.debugUnlockBackup;
  //     this.catalogModel.update((list) =>
  //       list.map((i) => ({ ...i, unlocked: backup?.get(i.id) ?? i.unlocked }))
  //     );
  //     this.debugUnlockBackup = null;
  //     this.debugAllUnlocked.set(false);
  //   } else {
  //     this.debugUnlockBackup = new Map(this.catalogModel().map((i) => [i.id, i.unlocked]));
  //     this.catalogModel.update((list) => list.map((i) => ({ ...i, unlocked: true })));
  //     this.debugAllUnlocked.set(true);
  //   }
  //
  //   this.maybeLoadFocusedDetail();
  // }

  itemByArtifactId(artifactId: string): CompendiumCardSummary | undefined {
    return this.catalogModel().find((i) => i.id === artifactId);
  }
}
