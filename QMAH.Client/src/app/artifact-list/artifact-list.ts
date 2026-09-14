// artifact-list.ts
import { Component, EventEmitter, Output, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CatalogService } from '../services/catalog-service';
import { ArtifactUnlockService } from '../services/artifact-unlock-service';
import { CatalogModel } from '../models/catalog-model';
import { ArtifactUnlockRecord, ArtifactDetail, CardEntry, CompendiumSkin } from '../models/artifact-unlock-model';

@Component({
  selector: 'app-artifact-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './artifact-list.html',
  styleUrl: './artifact-list.scss'
})
export class ArtifactList implements OnInit {
  // ---- 文物清單／分頁（沿用原本 artifact-list 的邏輯，型別改成 CardEntry 以支援放大檢視／解鎖） ----
  catalogModel = signal<CardEntry[]>([]);
  loading = signal(true);
  errorMsg = signal('');

  currentPage = signal(1);
  pageSize = 12;
  totalPages = signal(1);
  totalCount = signal(0);

  showForm = signal(false);
  editingArtifact = signal<CatalogModel | null>(null);

  isEmpty = computed(() => !this.loading() && !this.errorMsg() && this.catalogModel().length === 0);

  // ---- 圖鑑放大檢視／解鎖（原 artifact-unlock.ts 併入）----
  keys = signal(0);
  unlockLedger = signal<ArtifactUnlockRecord[]>([]);
  unlockedCount = computed(() => this.catalogModel().filter((i) => i.unlocked).length);

  focusedId = signal<string | null>(null);
  infoOpen = signal(false);
  confirmTargetId = signal<string | null>(null);
  ledgerOpen = signal(false);

  // ---- Debug：暫時把目前這頁全部切成「已解鎖」方便檢視畫面，不會呼叫任何解鎖 API ----
  debugAllUnlocked = signal(false);
  private debugUnlockBackup: Map<string, boolean> | null = null;

  /** 讓外部（父層路由）接手「玩家回答鑑賞」的導頁邏輯，避免元件直接耦合 Router */
  @Output() appreciationRequested = new EventEmitter<CardEntry>();

  private baseImageUrl = 'https://localhost:7249/api/v1/catalog/artifacts';

  constructor(
    private catalogService: CatalogService,
    private unlockService: ArtifactUnlockService,
  ) { }

  ngOnInit(): void {
    this.loadArtifacts();
    this.loadKeyBalance();
  }

  loadArtifacts(): void {
    this.loading.set(true);
    this.catalogService.getArtifacts(this.currentPage(), this.pageSize).subscribe({
      next: (res) => {
        this.catalogModel.set(res.items.map((model) => this.toCardEntry(model)));
        this.totalPages.set(res.totalPages);
        this.totalCount.set(res.totalCount);
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMsg.set(err.message);
        this.loading.set(false);
      }
    });
  }

  private loadKeyBalance(): void {
    this.unlockService.getKeyBalance().subscribe({
      next: (res) => this.keys.set(res.keys),
      error: (err) => console.error('[ArtifactList] loadKeyBalance failed', err),
    });
  }

  /**
   * 後端目前還沒有「圖鑑遊戲外皮／解鎖狀態／鑑賞詳情」的對應欄位或 API，
   * 這裡先用暫時的預設值把 CatalogModel 補成 CardEntry，讓畫面能先跑起來。
   * 等後端補上對應欄位／API 後，這個映射函式應該整個拿掉，直接用 API 回傳的 CardEntry。
   */
  private toCardEntry(model: CatalogModel): CardEntry {
    const placeholderSkin: CompendiumSkin = {
      emoji: '🖼️',
      color: '#2a5cad',
      type: model.categoryName,
      rarity: '★★☆☆☆',
      habitat: '－',
      desc: '',
    };
    const placeholderDetail: ArtifactDetail = {
      unifiedNumber: '－',
      workNumber: '－',
      title: model.name,
      titleEn: '',
      authorName: '－',
      creationPeriod: '－',
      quantity: '－',
      sourceUrl: null,
    };

    return {
      ...model,
      ...placeholderSkin,
      ...placeholderDetail,
      unlocked: false, // TODO: 後端有解鎖狀態欄位後改讀真實值
      unlockedAt: null,
    };
  }

  getImageUrl(path: string): string {
    return path;
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    if (this.debugAllUnlocked()) this.toggleDebugUnlockAll(); // 換頁前先還原，避免除錯狀態誤導
    this.currentPage.set(page);
    this.loadArtifacts();
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

  trackByArtifactId(_index: number, item: CardEntry): string {
    return item.id;
  }

  // ========== 以下為原 artifact-unlock.ts 的放大檢視／解鎖邏輯 ==========
  // items() 一律改成 catalogModel()，其餘互動邏輯不變。

  focusedItem = computed<CardEntry | null>(() => {
    const id = this.focusedId();
    if (id === null) return null;
    return this.catalogModel().find((i) => i.id === id) ?? null;
  });

  isOverlayOpen = computed(() => this.focusedId() !== null);

  confirmTarget = computed<CardEntry | null>(() => {
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

  keyCost(item: CardEntry): number {
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

  toggleLedger(): void {
    this.ledgerOpen.update((v) => !v);
  }

  /**
   * Debug 用：暫時把「這一頁目前載入的」文物全部切成已解鎖，方便檢視放大圖／資訊面板，
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
  }

  itemByArtifactId(artifactId: string): CardEntry | undefined {
    return this.catalogModel().find((i) => i.id === artifactId);
  }
}
