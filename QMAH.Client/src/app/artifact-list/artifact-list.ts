// artifact-list.ts
import { Component, EventEmitter, Output, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, of, switchMap } from 'rxjs';
import { CatalogService } from '../services/catalog-service';
import { ArtifactUnlockService } from '../services/artifact-unlock-service';
import { CatalogModel, CatalogDetailModel } from '../models/catalog-model';
import { ArtifactUnlockRecord, CardEntry, CompendiumSkin, CompendiumCardSummary } from '../models/artifact-unlock-model';
import { KeyService } from '../services/key-service';

/** 依年代分組後的顯示用結構（格狀列表只需要清單卡片，不含鑑賞細節） */
interface EraGroup {
  eraName: string;
  items: CompendiumCardSummary[];
}

@Component({
  selector: 'app-artifact-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  showForm = signal(false);
  editingArtifact = signal<CatalogModel | null>(null);

  // ---- 圖鑑放大檢視／解鎖（原 artifact-unlock.ts 併入）----
  keys = signal(0);
  unlockLedger = signal<ArtifactUnlockRecord[]>([]);
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

  // ---- Debug：暫時把全部文物切成「已解鎖」方便檢視畫面，不會呼叫任何解鎖 API ----
  debugAllUnlocked = signal(false);
  private debugUnlockBackup: Map<string, boolean> | null = null;

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

  private baseImageUrl = 'https://localhost:7249/api/v1/catalog/artifacts';

  constructor(
    private catalogService: CatalogService,
    private unlockService: ArtifactUnlockService,
    private keyService: KeyService,
    private router: Router,
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
      },
      error: (err) => {
        this.errorMsg.set(err.message);
        this.loading.set(false);
      },
    });
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
   * 右上角顯示的鑰匙數，改成「全部鑰匙的持有數量總和」（不是鑰匙種類數）。
   * 原本這裡打的是 ArtifactUnlockService.getKeyBalance()（一支還沒實作、
   * 假設回傳單一數字的端點）；key-list 那邊已經確認鑰匙資料其實是從
   * economy 這支 API 來的，所以這裡改用同一個 KeyService，跟 key-list
   * 用的是同一份資料來源，數字才會對得起來。
   */
  private loadKeyBalance(): void {
    this.keyService.getKeys().subscribe({
      next: (keys) => this.keys.set(keys.reduce((sum, key) => sum + key.balance, 0)),
      error: (err) => console.error('[ArtifactList] loadKeyBalance failed', err),
    });
  }

  /**
   * 後端目前還沒有「圖鑑遊戲外皮／解鎖狀態」的對應欄位或 API（這兩者本來就是純前端遊戲機制），
   * 這裡先用暫時的預設值把 CatalogModel 補成 CompendiumCardSummary。
   *
   * 文物本身的鑑賞細節（description / sizeText / primaryImagePath...）不在這裡用假資料頂著——
   * GET /catalog/artifacts/{id} 已經是真正可用的 API 了，所以改成點開卡片時才用
   * CatalogService.getArtifactById() 即時抓真資料（見 maybeLoadFocusedDetail()），不需要、也不該用假資料。
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
      unlocked: false, // TODO: 後端有解鎖狀態欄位後改讀真實值
      unlockedAt: null,
    };
  }

  getImageUrl(path: string): string {
    return path;
  }

  onAddClick(): void {
    this.editingArtifact.set(null);
    this.showForm.set(true);
  }

  onEditClick(catalogModel: CatalogModel): void {
    this.editingArtifact.set(catalogModel);
    this.showForm.set(true);
  }

  onFormSaved(): void {
    this.showForm.set(false);
    this.loadArtifacts();
  }

  onFormCancelled(): void {
    this.showForm.set(false);
  }

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

  confirmCost = computed(() => {
    const item = this.confirmTarget();
    return item ? this.keyCost(item) : 0;
  });

  confirmInsufficient = computed(() => this.keys() < this.confirmCost());

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

  keyCost(item: CompendiumCardSummary): number {
    return (item.rarity.match(/★/g) ?? []).length;
  }

  openUnlockConfirm(id: string): void {
    this.confirmTargetId.set(id);
  }

  cancelUnlockConfirm(): void {
    this.confirmTargetId.set(null);
  }

  confirmUnlock(): void {
    const target = this.confirmTarget();
    if (!target) return;
    if (this.confirmInsufficient()) return;

    this.unlockService.unlockByKey(target.id).subscribe({
      next: (result) => {
        this.catalogModel.update((list) =>
          list.map((i) => (i.id === result.item.id ? result.item : i))
        );
        this.keys.set(result.remainingKeys);
        this.unlockLedger.update((list) => [...list, result.record]);
        this.confirmTargetId.set(null);

        // 解鎖回應本身已經是完整 CardEntry（含 ArtifactDetail），如果玩家解鎖的
        // 正是目前放大檢視中的卡片，直接拿來當作 focusedDetail，不用再多打一次
        // CatalogService.getArtifactById()。
        if (this.focusedId() === result.item.id) {
          this.focusedDetail.set(result.item);
          this.focusedDetailLoading.set(false);
          this.focusedDetailError.set('');
        }
      },
      error: (err) => {
        // TODO: 依專案慣例改成 Toast / Snackbar 提示
        console.error('[ArtifactList] unlock failed', err);
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

  /** 導頁到鑰匙背包頁面；路徑要對應你 routes 裡實際設定的 path（這裡先假設是 'key-list'） */
  onKeyBagClick(): void {
    this.router.navigate(['/key-list']);
  }

  toggleLedger(): void {
    this.ledgerOpen.update((v) => !v);
  }

  /**
   * Debug 用：暫時把目前載入的全部文物切成已解鎖，方便檢視放大圖／資訊面板，
   * 不會呼叫 unlockByKey、不會扣鑰匙、也不會產生流水紀錄。再按一次會還原回切換前的真實狀態。
   */
  toggleDebugUnlockAll(): void {
    if (this.debugAllUnlocked()) {
      const backup = this.debugUnlockBackup;
      this.catalogModel.update((list) =>
        list.map((i) => ({ ...i, unlocked: backup?.get(i.id) ?? i.unlocked }))
      );
      this.debugUnlockBackup = null;
      this.debugAllUnlocked.set(false);
    } else {
      this.debugUnlockBackup = new Map(this.catalogModel().map((i) => [i.id, i.unlocked]));
      this.catalogModel.update((list) => list.map((i) => ({ ...i, unlocked: true })));
      this.debugAllUnlocked.set(true);
    }

    // Debug 切換可能改變了目前放大檢視中卡片的解鎖狀態，重新確認一次是否要載入細節。
    this.maybeLoadFocusedDetail();
  }

  itemByArtifactId(artifactId: string): CompendiumCardSummary | undefined {
    return this.catalogModel().find((i) => i.id === artifactId);
  }
}
