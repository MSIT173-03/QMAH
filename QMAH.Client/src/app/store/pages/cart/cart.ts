import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';

import {
  Breadcrumb,
  BreadcrumbItem,
  PageTitleRow,
  EmptyState,
  SessionBar,
} from '../../component';
import { CatalogApi } from '../../api';
import { HOME_PATH, PRODUCT_LIST_PATH } from '../../shared/paths';
import { injectCartState } from '../../shared/page-state';
import { toProductView } from '../../shared/product-view';

import { CartLine } from './cart-line/cart-line';
import { CartSummary } from './cart-summary/cart-summary';
import { CartAddons } from './cart-addons/cart-addons';
import { ScrollTop } from '../../component/scroll-top/scroll-top';
import { CartLineData, toCartLineData } from './cart.data';

/** 移除一行購物車項目前，淡出動畫的播放時間（需與 cart-line.scss 的動畫時長一致） */
const REMOVE_ANIMATION_MS = 300;
/** 新加入的購物車行進場動畫的播放時間（需與 cart-line.scss 的 cart-line-in 時長一致） */
const ENTER_ANIMATION_MS = 300;
/** 「再加購」顯示的商品件數 */
const ADDON_COUNT = 5;
/** 滿額免運門檻，與後端 CheckoutDtos.FreeShippingThreshold 一致 */
const FREE_SHIPPING_THRESHOLD = 1500;

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
  imports: [ScrollTop, SessionBar, Breadcrumb, PageTitleRow, EmptyState, CartLine, CartSummary, CartAddons],
  templateUrl: './cart.html',
  styleUrl: './cart.scss',
})
export class Cart {
  // inject() 只能在建立元件時呼叫；下方的回呼在之後才執行，必須先取好服務。
  private readonly catalogApi = inject(CatalogApi);

  /** 麵包屑導覽項目 */
  protected readonly breadcrumbItems: BreadcrumbItem[] = [{ label: '首頁', href: HOME_PATH }, { label: '購物車' }];

  /** 頁面標題列右側連結 */
  protected readonly continueShoppingLink = { label: '繼續選購 →', href: PRODUCT_LIST_PATH };

  /** 購物車狀態；每次異動後以 API 回應的內容（含金額摘要）取代 */
  protected readonly cartState = injectCartState();
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
  /** 最近一次購物車異動失敗的訊息；失敗時留在原頁面告知，不讓使用者誤以為已更新 */
  protected error = this.cartState.error;

  /** 金額摘要（後端以預設配送方式試算），供 app-cart-summary 顯示 */
  protected amounts = computed(() => this.cartState.cart()?.amounts ?? null);

  /** 按下「換一批」的次數：每按一次就往後看下一組排名，不是重新亂抽 */
  private readonly addonBatch = signal(0);

  /** 候選池：全站熱銷前 50 名（依累計銷量），只載入一次；查詢失敗時靜默隱藏此區塊 */
  private readonly addonPool = toSignal(
    this.catalogApi.getProducts({ order: 1, pageSize: 50 }).pipe(
      map((page) => page.items),
      catchError(() => of([])),
    ),
    { initialValue: [] },
  );

  /** 購物車商品小計（折扣後）與距離免運門檻的差額；已達門檻為 0 */
  private readonly shippingGap = computed(() => {
    const subtotal = this.cartItems().reduce((sum, item) => sum + item.lineTotal, 0);
    return Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  });

  /**
   * 「再加購」的推薦排序（每件候選商品打分，不隨機）：
   * 1. 湊免運：還沒達免運門檻時，單價剛好補上差額（差額～差額＋600 元）的商品加最多分，標「加購免運」；
   * 2. 搭配：與購物車同器類的加分，標「搭配同器類」；其餘器類只要熱銷也會入選，讓清單不全是同一種；
   * 3. 口碑與熱銷：累計銷量與評分越高越前面；
   * 4. 每個器類最多 2 件，避免整排同類；已在購物車的不再推薦。
   * 「換一批」依序看下一組名次。
   */
  private readonly addonRanked = computed(() => {
    const inCart = this.cartIds();
    const cartCats = new Set(this.cartItems().map((item) => item.category));
    const gap = this.shippingGap();
    // 從「再加購」剛加入的商品要留在清單裡（標示已加入）；其餘已在購物車內的不再推薦
    const added = this.addedAddonIds();
    const pool = this.addonPool().filter((product) => !inCart.has(product.id) || added.has(product.id));
    const maxSold = Math.max(1, ...pool.map((product) => product.soldCount));
    const scored = pool.map((product) => {
      const price = product.discountRate > 0 ? product.dealPrice : product.price;
      let score = 0.5 * (product.soldCount / maxSold) + 0.2 * (product.rating / 5);
      let reason = '熱銷';
      if (cartCats.has(product.category)) {
        score += 0.2;
        reason = '搭配同器類';
      }
      if (gap > 0 && price >= gap && price <= gap + 600) {
        score += 0.4 - (0.2 * (price - gap)) / 600;
        reason = '加購免運';
      }
      return { product, score, reason };
    });
    scored.sort((x, y) => y.score - x.score);
    const perCategory = new Map<string, number>();
    return scored.filter(({ product }) => {
      const used = perCategory.get(product.category) ?? 0;
      perCategory.set(product.category, used + 1);
      return used < 2;
    });
  });

  /** 本頁從「再加購」加入購物車的商品 ID */
  private readonly addedAddonIds = signal<ReadonlySet<string>>(new Set());
  /** 從「再加購」加入且目前仍在購物車內的商品；之後被移出購物車就恢復為一般卡片 */
  protected readonly addedAddons = computed<ReadonlySet<string>>(() => {
    const inCart = this.cartIds();
    return new Set([...this.addedAddonIds()].filter((id) => inCart.has(id)));
  });

  /** 「再加購」商品：本批排名的前 ADDON_COUNT 件；從這裡加入的保留並顯示已加入 */
  protected addons = computed(() => {
    const ranked = this.addonRanked();
    if (ranked.length === 0) return [];
    const start = (this.addonBatch() * ADDON_COUNT) % ranked.length;
    const batch = [...ranked.slice(start), ...ranked.slice(0, start)].slice(0, ADDON_COUNT);
    return batch.map(({ product, reason }) => ({ ...toProductView(product), reason }));
  });

  /** 「換一批」：看下一組名次；上一批已加入購物車的商品不再保留在清單中 */
  protected onRefreshAddons(): void {
    this.addedAddonIds.set(new Set());
    this.addonBatch.update((count) => count + 1);
  }

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
