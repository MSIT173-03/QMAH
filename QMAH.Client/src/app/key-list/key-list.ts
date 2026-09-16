// key-list.ts
import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KeyService } from '../services/key-service';
import { CatalogService } from '../services/catalog-service';
import { KeyModel, KeyFilter } from '../models/key-model';

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
  ) { }

  ngOnInit(): void {
    this.loadKeys();
    this.loadCategoryEraNames();
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
}
