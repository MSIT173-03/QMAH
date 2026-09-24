import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, switchMap } from 'rxjs';

import {
  Promobar,
  Breadcrumb,
  BreadcrumbItem,
  PageTitleRow,
  EmptyState,
  LoginPrompt,
} from '../../component';
import { CatalogApi } from '../../api';
import { CartItem } from '../../api/api.models';
import { HOME_PATH, PRODUCT_LIST_PATH } from '../../shared/paths';
import { injectCartState, injectSiteData } from '../../shared/page-state';
import { toProductView } from '../../shared/product-view';

import { CartLine } from './cart-line/cart-line';
import { CartSummary } from './cart-summary/cart-summary';
import { CartAddons } from './cart-addons/cart-addons';
import { CartLineData, toCartLineData } from './cart.data';

/** 移除一行購物車項目前，淡出動畫的播放時間（需與 cart-line.scss 的動畫時長一致） */
const REMOVE_ANIMATION_MS = 300;
/** 新加入的購物車行進場動畫的播放時間（需與 cart-line.scss 的 cart-line-in 時長一致） */
const ENTER_ANIMATION_MS = 300;
/** 「再加購」顯示的商品件數 */
const ADDON_COUNT = 5;
/** 「再加購」多取的備用件數：使用者陸續加入其中幾件後，清單仍能補滿 ADDON_COUNT */
const ADDON_SPARE = 5;

/** 回傳移除指定 ID 後的新集合（不修改原集合，讓 signal 能偵測到變動） */
function withoutId(ids: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(ids);
  next.delete(id);
  return next;
}

/**
 * 購物車頁面。
 * 統整頁首、麵包屑、標題列、購物車行清單、金額摘要與再加購區塊；
 * 購物車內容與所有金額皆由 API 取得，數量調整、移除（含離場動畫）與再加購
 * 皆在此呼叫 API 並以回應內容更新購物車狀態，各子元件僅負責顯示與回報操作。
 */
@Component({
  selector: 'app-cart',
  host: { class: 'store-app' },
  imports: [Promobar, Breadcrumb, PageTitleRow, EmptyState, LoginPrompt, CartLine, CartSummary, CartAddons],
  templateUrl: './cart.html',
  styleUrl: './cart.scss',
})
export class Cart {
  /** 麵包屑導覽項目 */
  protected readonly breadcrumbItems: BreadcrumbItem[] = [{ label: '首頁', href: HOME_PATH }, { label: '購物車' }];

  /** 頁面標題列右側連結 */
  protected readonly continueShoppingLink = { label: '繼續選購 →', href: PRODUCT_LIST_PATH };

  /** 購物車狀態；每次異動後以 API 回應的內容（含金額摘要）取代 */
  protected readonly cartState = injectCartState();
  /** 頂部公告列所需的公告、會員點數與折價券 */
  protected readonly site = injectSiteData();
  /** 購物車品項；尚在載入時為空陣列 */
  private readonly cartItems = computed(() => this.cartState.cart()?.items ?? []);
  /** 購物車內的商品 ID */
  private readonly cartIds = computed(() => new Set(this.cartItems().map((item) => item.productId)));
  /** 正在執行移除動畫、尚未真正從購物車移除的商品 ID */
  private leavingIds = signal<ReadonlySet<string>>(new Set());
  /** 剛從再加購加入、正在播放進場動畫的商品 ID */
  private enteringIds = signal<ReadonlySet<string>>(new Set());

  /** 購物車行清單，供 app-cart-line 逐行顯示；其餘統計數字皆由此換算 */
  protected lines = computed<CartLineData[]>(() => {
    const leavingIds = this.leavingIds();
    const enteringIds = this.enteringIds();
    return this.cartItems().map((item) =>
      toCartLineData(item, leavingIds.has(item.productId), enteringIds.has(item.productId)),
    );
  });

  /** 購物車內容是否已載入 */
  protected loaded = computed(() => this.cartState.cart() !== null);
  /** 購物車是否含有商品 */
  protected hasItems = computed(() => this.lines().length > 0);
  /** 購物車件數，顯示於頂部公告列的購物車連結 */
  protected count = this.cartState.count;
  /** ui-integration: 購物車異動失敗要留在原頁面並明確告知，不讓使用者誤以為已更新。 */
  protected error = this.cartState.error;

  /** 金額摘要（後端以預設配送方式試算），供 app-cart-summary 顯示 */
  protected amounts = computed(() => this.cartState.cart()?.amounts ?? null);

  /**
   * 購物車內件數加總最多的器類；件數相同時取購物車中較早加入的品項所屬器類。
   * 購物車清空後保留上一次的器類（而非回到 null），避免「再加購」清單在
   * 最後一件商品被移除的瞬間跟著消失。
   */
  private readonly topCategory = linkedSignal<CartItem[], string | null>({
    source: this.cartItems,
    computation: (items, previous) => {
      const totals = new Map<string, number>();
      for (const item of items) {
        if (item.category) totals.set(item.category, (totals.get(item.category) ?? 0) + item.qty);
      }
      let top: string | null = null;
      let topQty = 0;
      for (const [category, qty] of totals) {
        if (qty > topQty) [top, topQty] = [category, qty];
      }
      return top ?? previous?.value ?? null;
    },
  });

  // inject() 只能在建立元件時呼叫；下方 switchMap 的回呼在之後才執行，必須先取好服務。
  private readonly catalogApi = inject(CatalogApi);

  /**
   * 同器類的隨機商品（排序 6：隨機）。只在器類改變時重新抽選，
   * 調整數量或加入其中一件時清單不會整組換掉；查詢失敗時靜默隱藏此區塊。
   * 隨機結果可能包含購物車內同器類的品項，因此連同這些品項數與備用件數一起多取，排除後再截到 ADDON_COUNT。
   */
  private readonly addonCandidates = toSignal(
    toObservable(this.topCategory).pipe(
      switchMap((cat) => {
        if (!cat) return of([]);
        const inCategory = this.cartItems().filter((item) => item.category === cat).length;
        return this.catalogApi.getProducts({ cat, order: 6, pageSize: ADDON_COUNT + ADDON_SPARE + inCategory }).pipe(
          map((page) => page.items),
          catchError(() => of([])),
        );
      }),
    ),
    { initialValue: [] },
  );

  /** 本頁從「再加購」加入購物車的商品 ID */
  private readonly addedAddonIds = signal<ReadonlySet<string>>(new Set());
  /** 從「再加購」加入且目前仍在購物車內的商品；之後被移出購物車就恢復為一般卡片 */
  protected readonly addedAddons = computed<ReadonlySet<string>>(() => {
    const inCart = this.cartIds();
    return new Set([...this.addedAddonIds()].filter((id) => inCart.has(id)));
  });

  /** 「再加購」商品：排除已在購物車內的品項（從這裡加入的保留並顯示已加入），最多 ADDON_COUNT 件 */
  protected addons = computed(() => {
    const inCart = this.cartIds();
    const added = this.addedAddonIds();
    return this.addonCandidates()
      .filter((product) => !inCart.has(product.id) || added.has(product.id))
      .slice(0, ADDON_COUNT)
      .map(toProductView);
  });

  /** 變更某商品的購物車數量；數量減至 0 視同移除 */
  protected onQtyChange(id: string, qty: number): void {
    if (qty <= 0) {
      this.onRemove(id);
      return;
    }
    this.cartState.update(id, qty);
  }

  /** 移除購物車中的商品：先觸發離場動畫，動畫結束後才向 API 移除 */
  protected onRemove(id: string): void {
    this.leavingIds.update((ids) => new Set(ids).add(id));
    setTimeout(() => {
      this.cartState.remove(id, () => this.leavingIds.update((ids) => withoutId(ids, id)));
    }, REMOVE_ANIMATION_MS);
  }

  /**
   * 將再加購商品加入購物車（數量 1）。加入成功後卡片保留並標示已加入；
   * 第一次加入時新的一行出現並播放進場動畫，再次點擊只累加數量。未登入或加入失敗時不變。
   */
  protected onAddAddon(id: string): void {
    const isNewLine = !this.cartIds().has(id);
    this.cartState.add(id, 1, () => {
      this.addedAddonIds.update((ids) => new Set(ids).add(id));
      if (!isNewLine) return;
      this.enteringIds.update((ids) => new Set(ids).add(id));
      setTimeout(() => this.enteringIds.update((ids) => withoutId(ids, id)), ENTER_ANIMATION_MS);
    });
  }
}
