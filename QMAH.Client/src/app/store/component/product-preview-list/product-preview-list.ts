import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { Router } from '@angular/router';
import { QmahIconComponent } from '../../../shared/components/qmah-icon/qmah-icon';
import { ProductDetail } from '../../api/api.models';
import { bumpAddToCart } from '../../shared/bump';
import { formatNumber } from '../../shared/format';
import { displayImageWithFallback, toDisplayImage } from '../../shared/image-utils';
import { productPath } from '../../shared/paths';
import {
  NO_REVIEWS_LABEL,
  PriceView,
  ProductViewData,
  formatRating,
  formatReviews,
  toPriceView,
} from '../../shared/product-view';
import { StoreLink } from '../../shared/store-link';

/** 清單單列的顯示資料 */
interface PreviewRowView {
  item: ProductViewData;
  /** 品牌與器類以「 · 」串接的說明文字 */
  meta: string;
  priceView: PriceView;
  /** 目前嘗試中的縮圖網址；讀取失敗到沒有可用圖片時為 null */
  thumb: string | null;
}

/** 品牌與器類以「 · 」串接的說明文字，略過無值的項目 */
function toMeta(item: ProductViewData): string {
  return [item.brand, item.cat].filter(Boolean).join(' · ');
}

/**
 * 商品預覽清單：商品列表頁「列表顯示」模式使用。
 * 左側是只有縮圖、名稱與價格的精簡清單，右側是黏著的預覽欄，顯示選取商品的大圖、文物說明、尺寸、評價與購買操作，
 * 不必離開列表就能看商品細節。滑鼠移到某列上或以方向鍵移動都會切換選取的商品
 * （以滑鼠移動而非進入事件判斷，頁面捲動時游標下方換了一列不會跟著切換）；
 * 點擊某列會把預覽固定在該商品，滑鼠移到其他列不再切換，直到點擊其他列（改固定那一件）或再點一次固定中的列（取消固定）；
 * 窄螢幕放不下兩欄時，細節改為從選取的那一列往下拉開，與該列連成同一個區塊。
 * 文物說明與尺寸不在商品清單 API 內：選取的商品以 selectionChange 回報，由外部查詢商品詳情後放進 details 傳入；
 * 尚未查到時說明位置顯示讀取中的佔位條。
 */
@Component({
  selector: 'app-product-preview-list',
  imports: [StoreLink, QmahIconComponent],
  templateUrl: './product-preview-list.html',
  styleUrl: './product-preview-list.scss',
})
export class ProductPreviewList {
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  /** 清單中的商品，順序即顯示順序 */
  items = input<ProductViewData[]>([]);

  /** 已查到的商品詳情（文物說明、尺寸），以商品編號為鍵；沒有該編號代表尚在讀取，null 代表查詢失敗 */
  details = input<Record<string, ProductDetail | null>>({});

  /** 選取的商品改變時觸發（含清單載入後預設選取第一件），帶出商品編號 */
  selectionChange = output<string>();
  /** 點擊預覽欄的加入購物車按鈕時觸發，帶出商品編號 */
  addToCart = output<string>();

  /** 以下為固定版面文字 */
  protected readonly listLabel = '商品清單';
  protected readonly paneLabel = '商品預覽';
  protected readonly slotLabel = '影像待補';
  protected readonly dimensionsLabel = '尺寸';
  protected readonly addCartLabel = '加入購物車';
  protected readonly detailLabel = '查看商品';
  protected readonly noReviewsLabel = NO_REVIEWS_LABEL;
  protected readonly pinHint = '點擊固定預覽';
  protected readonly unpinHint = '已固定預覽，再點一次取消';

  /** 選取中的商品編號；清單內容更換（換頁、改篩選）時回到第一件 */
  private selectedId = linkedSignal(() => this.items()[0]?.id ?? null);
  /** 固定預覽的商品編號，null 代表未固定（預覽跟著滑鼠切換）；清單內容更換時取消固定 */
  protected pinnedId = linkedSignal<string | null>(() => (this.items(), null));
  /** 選取中的商品在清單中的索引，清單為空時為 0 */
  protected selectedIndex = computed(() =>
    Math.max(0, this.items().findIndex((item) => item.id === this.selectedId())),
  );
  /** 選取中的商品，清單為空時為 null */
  protected selected = computed<ProductViewData | null>(() => this.items()[this.selectedIndex()] ?? null);

  /** 預覽欄要顯示的商品（至多一件）；以清單形式提供給模板，換一件商品時預覽欄會重新建立，窄螢幕的拉開動畫才會重播 */
  protected previewed = computed(() => {
    const product = this.selected();
    return product ? [product] : [];
  });
  /** 選取中商品的詳情：undefined 代表尚在讀取，null 代表查詢失敗 */
  protected selectedDetail = computed(() => {
    const id = this.selected()?.id;
    return id === undefined ? null : this.details()[id];
  });

  /** 各商品縮圖讀取失敗的次數：0 用縮圖、1 改用同一件文物的 display 圖、2 以上顯示佔位狀態 */
  private thumbFailures = signal<Record<string, number>>({});
  /** 清單各列的顯示資料 */
  protected rows = computed<PreviewRowView[]>(() => {
    const failures = this.thumbFailures();
    return this.items().map((item) => {
      const failed = failures[item.id] ?? 0;
      const display = toDisplayImage(item.coverImage);
      const candidates = display === item.coverImage ? [item.coverImage] : [item.coverImage, display];
      return { item, meta: toMeta(item), priceView: toPriceView(item.price, item.was), thumb: candidates[failed] ?? null };
    });
  });

  /** 預覽欄的商品圖：先載入 display 圖，失敗時退回縮圖 */
  protected readonly image = displayImageWithFallback(() => this.selected()?.coverImage ?? null);
  /** 預覽欄的商品頁連結網址 */
  protected link = computed(() => productPath(this.selected()?.id ?? ''));
  /** 預覽欄的品牌與器類說明文字 */
  protected meta = computed(() => {
    const product = this.selected();
    return product ? toMeta(product) : '';
  });
  /** 預覽欄的價格列顯示字串 */
  protected priceView = computed(() => {
    const product = this.selected();
    return toPriceView(product?.price ?? 0, product?.was ?? null);
  });
  /** 預覽欄的評分與評論數；沒有評論時改顯示提示文字 */
  protected ratingText = computed(() => {
    const product = this.selected();
    if (!product || product.reviews <= 0) return null;
    return `${formatRating(product.rating)} · ${formatReviews(product.reviews, '則')}`;
  });
  /** 預覽欄的已售數量顯示字串 */
  protected soldText = computed(() => `${formatNumber(this.selected()?.sold ?? 0)} 已售`);

  private readonly rowElements = viewChildren<ElementRef<HTMLElement>>('row');

  constructor() {
    effect(() => {
      const id = this.selectedId();
      if (id) this.selectionChange.emit(id);
    });
  }

  /** 滑鼠移到某列上：未固定預覽時選取它 */
  protected onRowHover(id: string): void {
    if (this.pinnedId() === null) this.selectedId.set(id);
  }

  /**
   * 點擊某列：把預覽固定在它（點的是固定中的那一列則取消固定），並在畫面更新後把該列捲進可視範圍。
   * 窄螢幕上原本拉開的細節在它上方收起時，被點的那一列會跟著往上移，可能跑出畫面。
   */
  protected onRowClick(id: string, index: number): void {
    this.pinnedId.update((pinned) => (pinned === id ? null : id));
    this.selectedId.set(id);
    afterNextRender(
      () => this.rowElements()[index]?.nativeElement.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }),
      { injector: this.injector },
    );
  }

  /** 縮圖讀取失敗：改試下一個可用的圖片 */
  protected onThumbError(id: string): void {
    this.thumbFailures.update((failures) => ({ ...failures, [id]: (failures[id] ?? 0) + 1 }));
  }

  /**
   * 清單的鍵盤操作：上下方向鍵與 Home／End 移動選取並把焦點帶到該列（固定預覽時連同固定一起移過去），Enter 進入商品頁。
   * 只處理焦點在列本身的按鍵。
   */
  protected onRowKeydown(event: KeyboardEvent, index: number): void {
    if (event.target !== event.currentTarget) return;
    const last = this.items().length - 1;
    const targets: Record<string, number> = {
      ArrowDown: Math.min(last, index + 1),
      ArrowUp: Math.max(0, index - 1),
      Home: 0,
      End: last,
    };
    if (event.key === 'Enter') {
      event.preventDefault();
      this.router.navigateByUrl(productPath(this.items()[index].id));
      return;
    }
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const id = this.items()[target].id;
    this.selectedId.set(id);
    if (this.pinnedId() !== null) this.pinnedId.set(id);
    this.rowElements()[target]?.nativeElement.focus();
  }

  /** 按下加入購物車：通知外部，並讓按鈕放大再還原一下 */
  protected onAddToCart(event: Event, id: string): void {
    this.addToCart.emit(id);
    bumpAddToCart(event.currentTarget as HTMLElement);
  }
}
