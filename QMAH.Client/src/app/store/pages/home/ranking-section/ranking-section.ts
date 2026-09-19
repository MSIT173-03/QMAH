import { Component, computed, inject, input, output, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, map, of, switchMap } from 'rxjs';
import { SectionHead, PillGroup, PillOption, ProductCard } from '../../../component';
import { HomeApi } from '../../../api';
import { Product } from '../../../api/api.models';
import { pad } from '../../../shared/format';
import { toProductView } from '../../../shared/product-view';
import { BadgedProductView, RANKING_TABS } from '../home.data';

/** 熱銷排行最多顯示的商品數量 */
const RANKING_LIMIT = 10;

/** 首頁「熱銷排行」區塊：可依分類分頁切換，最多顯示 10 件商品 */
@Component({
  selector: 'app-ranking-section',
  imports: [SectionHead, PillGroup, ProductCard],
  templateUrl: './ranking-section.html',
  styleUrls: [
    './ranking-section.scss',
  ],
})
export class RankingSection {
  private readonly homeApi = inject(HomeApi);

  /** 點擊任一商品卡片的加入購物車按鈕時觸發，帶出商品 ID */
  addToCart = output<string>();

  /** 分類分頁清單（第一項視為「全站」不篩選） */
  protected readonly tabs = RANKING_TABS;
  /** 目前選取的分類分頁索引 */
  protected activeTab = signal(0);
  /** 分類分頁選項，供 app-pill-group 顯示與切換用 */
  protected tabOptions = computed<PillOption[]>(() =>
    this.tabs.map((name, i) => ({ label: name, active: i === this.activeTab() })),
  );
  /** 全站熱銷排行商品（來自 products/info，販賣數量前 10 項） */
  products = input<Product[]>([]);

  /** 依選取分類取得的排行商品，角標為排名序號；「全站」直接使用 products，其餘分類另向 API 取得 */
  protected rankingItems = toSignal(
    combineLatest([toObservable(this.activeTab), toObservable(this.products)]).pipe(
      switchMap(([tab, products]) =>
        tab === 0
          ? of(products)
          : this.homeApi.getRankings({ cat: this.tabs[tab], limit: RANKING_LIMIT }),
      ),
      map((items): BadgedProductView[] =>
        items.map((item, i) => ({ ...toProductView(item), badge: `#${pad(i + 1)}`, badgeVariant: 'ink' })),
      ),
    ),
    { initialValue: [] },
  );

  /** 切換分類分頁 */
  protected pickTab(index: number): void {
    this.activeTab.set(index);
  }
}
