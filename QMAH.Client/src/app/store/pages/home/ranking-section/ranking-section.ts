import { Component, ElementRef, computed, inject, output, signal, viewChild } from '@angular/core';
import { SectionHead, PillGroup, PillOption, ProductCard } from '../../../component';
import { HomeApi } from '../../../api';
import { Product } from '../../../api/api.models';
import { PRODUCT_LIST_PATH } from '../../../shared/paths';
import { StoreLink } from '../../../shared/store-link';
import { gridColumns } from '../../../shared/grid-columns';
import { toProductView } from '../../../shared/product-view';
import { BadgedProductView, HOME_PRODUCT_COUNT, HOME_PRODUCT_ROWS, RANKING_TAB_COUNT } from '../home.data';

/** 首頁「熱銷排行」區塊：可依分類分頁切換，向 API 取 HOME_PRODUCT_COUNT 件商品，但固定只顯示兩行 */
@Component({
  selector: 'app-ranking-section',
  imports: [SectionHead, PillGroup, ProductCard, StoreLink],
  templateUrl: './ranking-section.html',
  styleUrl: './ranking-section.scss',
})
export class RankingSection {
  private readonly homeApi = inject(HomeApi);

  /** 點擊任一商品卡片的加入購物車按鈕時觸發，帶出商品 ID */
  addToCart = output<string>();

  /** 各分頁的排行資料（鍵：'' 為全站，其餘為器類名稱）；載入時一次預先抓好，切換分頁直接取用，不再等網路 */
  private readonly cache = signal<Record<string, Product[]>>({});
  /** 分頁＝全站＋實際賣得最好的前幾個器類：取全站熱銷前 50 名，把已售件數依器類加總後排序（不是看商品件數） */
  protected readonly tabs = signal<string[]>(['全站']);

  constructor() {
    this.homeApi.getRankings({ limit: 50 }).subscribe((items) => {
      const sold = new Map<string, number>();
      for (const item of items) sold.set(item.category, (sold.get(item.category) ?? 0) + item.soldCount);
      const top = [...sold].sort((x, y) => y[1] - x[1]).slice(0, RANKING_TAB_COUNT).map(([name]) => name);
      this.cache.update((c) => ({ ...c, '': items.slice(0, HOME_PRODUCT_COUNT) }));
      this.tabs.set(['全站', ...top]);
      for (const cat of top) {
        // 全站前 50 名裡該器類的商品已經夠排滿兩行就直接用，不再多打一支 API
        const own = items.filter((item) => item.category === cat);
        if (own.length >= HOME_PRODUCT_COUNT) {
          this.cache.update((c) => ({ ...c, [cat]: own.slice(0, HOME_PRODUCT_COUNT) }));
          continue;
        }
        this.homeApi
          .getRankings({ cat, limit: HOME_PRODUCT_COUNT })
          .subscribe((list) => this.cache.update((c) => ({ ...c, [cat]: list })));
      }
    });
  }

  /** 目前選取的分類；undefined＝全站 */
  protected activeCat = signal<string | undefined>(undefined);
  /** 「完整榜單」連結：商品列表頁以熱銷排序，並帶上目前的器類 */
  protected readonly moreHref = computed(() => {
    const cat = this.activeCat();
    return `${PRODUCT_LIST_PATH}?view=hot${cat ? `&cat=${encodeURIComponent(cat)}` : ''}`;
  });
  /** 分類分頁選項，供 app-pill-group 顯示與切換用 */
  protected tabOptions = computed<PillOption[]>(() =>
    this.tabs().map((name, i) => ({ label: name, active: (i === 0 ? undefined : name) === this.activeCat() })),
  );
  /** 目前分頁的排行商品，角標為排名序號；該分頁還沒載入完時先維持上一個分頁的內容，不閃空白 */
  private shown: Product[] = [];
  protected rankingItems = computed((): BadgedProductView[] => {
    const list = this.cache()[this.activeCat() ?? ''];
    if (list) this.shown = list;
    return this.shown.map((item, i) => ({ ...toProductView(item), badge: String(i + 1), badgeVariant: i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank' }));
  });

  private readonly grid = viewChild<ElementRef<HTMLElement>>('grid');
  private readonly columns = gridColumns(this.grid);
  /** 實際顯示的商品：欄數 × 固定行數，超出的不渲染 */
  protected visibleItems = computed(() => this.rankingItems().slice(0, this.columns() * HOME_PRODUCT_ROWS));

  /** 切換分類分頁 */
  protected pickTab(index: number): void {
    this.activeCat.set(index === 0 ? undefined : this.tabs()[index]);
  }
}
