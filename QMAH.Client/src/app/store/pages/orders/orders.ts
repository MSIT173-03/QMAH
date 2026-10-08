import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';

import {
  Breadcrumb,
  BreadcrumbItem,
  EmptyState,
  OrderCancelDialog,
  PageTitleRow,
  Pagination,
  ScrollTop,
  SessionBar,
} from '../../component';
import { OrdersApi } from '../../api';
import { MyOrder, MyOrderPage } from '../../api/api.models';
import { submitEcpayForm } from '../../shared/ecpay-form';
import { formatDateTime, formatMoney } from '../../shared/format';
import { injectCartState } from '../../shared/page-state';
import { HOME_PATH, PRODUCT_LIST_PATH } from '../../shared/paths';

/** 取消成功後頁面會重新整理（頂部列的點數與折價券張數才會更新），結果訊息暫存在 sessionStorage */
const CANCEL_NOTICE_KEY = 'qmah.store.orderCancelNotice';
/** 前往付款時先開好的分頁名稱；表單送出時以這個名稱為 target */
const ECPAY_WINDOW_NAME = 'qmah-ecpay-checkout';

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: '待付款',
  PAID: '已付款',
  FULFILLING: '撿貨中',
  SHIPPED: '已寄送',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  COD: '貨到付款',
  CREDIT_CARD: '信用卡',
};

/** 篩選頁籤：全部、待付款、處理中（已付款／撿貨中）、已寄送、已完成、已取消 */
export type OrderFilter = 'ALL' | 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED';

const ORDER_FILTERS: { key: OrderFilter; label: string }[] = [
  { key: 'ALL', label: '全部' },
  { key: 'PENDING', label: '待付款' },
  { key: 'PROCESSING', label: '處理中' },
  { key: 'SHIPPED', label: '已寄送' },
  { key: 'COMPLETED', label: '已完成' },
  { key: 'CANCELLED', label: '已取消' },
];

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: '尚未付款',
  PAID: '已付款',
  FAILED: '付款失敗',
  CANCELLED: '已取消',
  REFUND_REQUIRED: '待退款',
};

const FLOW: { status: string; label: string }[] = [
  { status: 'PENDING_PAYMENT', label: '訂單成立' },
  { status: 'PAID', label: '已付款' },
  { status: 'FULFILLING', label: '撿貨中' },
  { status: 'SHIPPED', label: '已寄送' },
  { status: 'COMPLETED', label: '已完成' },
];

function filterGroupOf(status: string): OrderFilter {
  if (status === 'PENDING_PAYMENT') return 'PENDING';
  if (status === 'PAID' || status === 'FULFILLING') return 'PROCESSING';
  if (status === 'SHIPPED') return 'SHIPPED';
  if (status === 'COMPLETED') return 'COMPLETED';
  return 'CANCELLED';
}

function buildSteps(status: string): OrderRow['steps'] {
  if (status === 'CANCELLED') {
    return [{ label: '訂單成立', state: 'done' }, { label: '已取消', state: 'cancelled' }];
  }
  const at = Math.max(0, FLOW.findIndex((step) => step.status === status));
  return FLOW.map((step, index) => ({
    label: step.label,
    state: index < at ? 'done' : index === at ? (status === 'COMPLETED' ? 'done' : 'current') : 'todo',
  }));
}

/** 畫面上一筆訂單需要的顯示文字與可用動作 */
interface OrderRow {
  id: string;
  orderNo: string;
  status: string;
  statusLabel: string;
  paymentLabel: string;
  payableLabel: string;
  createdLabel: string;
  itemsLabel: string;
  /** 商品明細（名稱與數量） */
  lines: { name: string; quantity: number }[];
  totalQuantity: number;
  /** 訂單進度：已完成／進行中／尚未到達的步驟；已取消的訂單只有「訂單成立」與「已取消」 */
  steps: { label: string; state: 'done' | 'current' | 'todo' | 'cancelled' }[];
  paymentStatusLabel: string;
  filterGroup: OrderFilter;
  /** 付款狀態的補充說明（付款失敗、需人工退款）；沒有時為空字串 */
  paymentNote: string;
  canCancel: boolean;
  canPay: boolean;
}

/**
 * 我的訂單頁：列出目前會員的訂單（GET /me/orders）。
 * 待付款的訂單可以取消（POST /store/orders/{id}/cancel，後端在同一筆交易內歸還庫存、折價券與點數）；
 * 信用卡訂單另可「前往付款」，每次都向後端取得新的綠界表單（POST /store/orders/{id}/ecpay-checkout），
 * 不沿用訂單資料或結帳完成時的表單。綠界付款頁的「返回商店」也會回到本頁。
 */
@Component({
  selector: 'app-orders',
  host: { class: 'store-app' },
  imports: [ScrollTop, SessionBar, Breadcrumb, PageTitleRow, EmptyState, Pagination, OrderCancelDialog],
  templateUrl: './orders.html',
  styleUrl: './orders.scss',
})
export class Orders {
  private readonly ordersApi = inject(OrdersApi);
  private readonly document = inject(DOCUMENT);

  /** 頁面持有的購物車狀態，供頂部公告列與登入提示共用 */
  protected readonly cart = injectCartState();

  protected readonly breadcrumbItems: BreadcrumbItem[] = [{ label: '首頁', href: HOME_PATH }, { label: '我的訂單' }];

  /** 目前頁碼與重新載入次數，任一變動都重新查詢 */
  private readonly query = signal({ page: 1, reload: 0 });
  protected readonly loadError = signal(false);

  /** 訂單分頁；undefined 代表尚在載入，null 代表查詢失敗 */
  private readonly result = toSignal(
    toObservable(this.query).pipe(
      switchMap(({ page }) => {
        this.loadError.set(false);
        return this.ordersApi.getMyOrders(page).pipe(
          catchError((error: unknown) => {
            if (error instanceof HttpErrorResponse && error.status === 401) this.cart.handleUnauthorized();
            this.loadError.set(true);
            return of(null as MyOrderPage | null);
          }),
        );
      }),
    ),
  );

  protected readonly loading = computed(() => this.result() === undefined);
  protected readonly orders = computed(() => (this.result()?.items ?? []).map(toRow));
  protected readonly isEmpty = computed(() => !!this.result() && this.orders().length === 0);

  /** 目前頁面的狀態篩選與每個頁籤的筆數 */
  protected readonly filter = signal<OrderFilter>('ALL');
  protected readonly filters = computed(() =>
    ORDER_FILTERS.map((tab) => ({
      ...tab,
      count: tab.key === 'ALL' ? this.orders().length : this.orders().filter((order) => order.filterGroup === tab.key).length,
    })),
  );
  protected readonly visibleOrders = computed(() =>
    this.filter() === 'ALL' ? this.orders() : this.orders().filter((order) => order.filterGroup === this.filter()),
  );

  /** 展開查看詳情的訂單 */
  protected readonly expanded = signal<ReadonlySet<string>>(new Set());
  protected isExpanded(id: string): boolean {
    return this.expanded().has(id);
  }
  protected toggle(id: string): void {
    this.expanded.update((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }
  protected readonly page = computed(() => this.result()?.page ?? 1);
  protected readonly totalPages = computed(() => Math.max(1, this.result()?.totalPages ?? 1));

  /** 固定的版面文字 */
  protected readonly emptyTitle = '目前沒有訂單';
  protected readonly emptyDesc = '挑選喜歡的商品後，訂單會出現在這裡。';
  protected readonly emptyCtaLabel = '前往商品列表';
  protected readonly productListHref = PRODUCT_LIST_PATH;
  protected readonly errorTitle = '訂單資料暫時無法載入';
  protected readonly errorDesc = '伺服器目前沒有回應，請稍後再試。';
  protected readonly errorCtaLabel = '重新載入';
  protected readonly cancelLabel = '取消訂單';
  protected readonly payLabel = '前往付款';
  protected readonly payingLabel = '準備付款頁…';
  protected readonly paidHint = '若已在綠界完成付款，請不要取消，付款結果可能需要幾分鐘才會更新。';

  /** 等待使用者確認取消的訂單；null 代表確認視窗關閉 */
  protected readonly pendingCancel = signal<OrderRow | null>(null);
  protected readonly cancelling = signal(false);
  /** 正在取得付款表單的訂單 Id */
  protected readonly payingId = signal<string | null>(null);
  /** 最近一次操作的結果訊息 */
  protected readonly feedback = signal<{ kind: 'success' | 'error'; text: string } | null>(null);

  constructor() {
    const notice = this.takeCancelNotice();
    if (notice) this.feedback.set({ kind: 'success', text: notice });
  }

  protected onPick(page: number): void {
    this.query.update((query) => ({ ...query, page }));
  }

  protected onReload(): void {
    this.query.update((query) => ({ ...query, reload: query.reload + 1 }));
  }

  protected dismissFeedback(): void {
    this.feedback.set(null);
  }

  protected onCancelClick(order: OrderRow): void {
    this.feedback.set(null);
    this.pendingCancel.set(order);
  }

  protected onCancelDismiss(): void {
    this.pendingCancel.set(null);
  }

  /** 確認取消：成功後重新整理頁面，讓訂單列表、頂部列的點數與折價券張數一起更新 */
  protected onCancelConfirm(): void {
    const order = this.pendingCancel();
    if (!order || this.cancelling()) return;

    this.cancelling.set(true);
    this.ordersApi.cancelOrder(order.id).subscribe({
      next: () => {
        this.saveCancelNotice(`訂單 ${order.orderNo} 已取消，庫存、折價券與點數已歸還。`);
        this.reloadPage();
      },
      error: (error: unknown) => {
        this.cancelling.set(false);
        this.pendingCancel.set(null);
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.cart.handleUnauthorized();
          return;
        }
        this.feedback.set({ kind: 'error', text: problemDetail(error, '取消失敗，請稍後再試。') });
        // 已付款（409）時訂單狀態可能已更新，重新載入列表反映最新狀態。
        this.onReload();
      },
    });
  }

  /**
   * 前往付款：點擊當下先同步開好具名分頁（之後才開會被當成快顯視窗擋下），
   * 取得新的綠界表單後把表單送到該分頁；分頁被擋下時改在目前分頁前往綠界。
   */
  protected onPay(order: OrderRow): void {
    if (this.payingId()) return;
    this.feedback.set(null);
    const view = this.document.defaultView;
    const payWindow = view?.open('', ECPAY_WINDOW_NAME) ?? null;

    this.payingId.set(order.id);
    this.ordersApi.createEcpayCheckout(order.id).subscribe({
      next: (checkout) => {
        this.payingId.set(null);
        submitEcpayForm(this.document, checkout, payWindow ? ECPAY_WINDOW_NAME : '_self');
      },
      error: (error: unknown) => {
        this.payingId.set(null);
        payWindow?.close();
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.cart.handleUnauthorized();
          return;
        }
        this.feedback.set({ kind: 'error', text: problemDetail(error, '目前無法前往付款，請稍後再試。') });
        this.onReload();
      },
    });
  }

  /** 重新整理頁面（獨立成方法，測試時可以替換掉） */
  protected reloadPage(): void {
    this.document.defaultView?.location.reload();
  }

  private saveCancelNotice(text: string): void {
    try {
      this.document.defaultView?.sessionStorage.setItem(CANCEL_NOTICE_KEY, text);
    } catch {
      // 訊息只是輔助資訊，不影響取消結果。
    }
  }

  private takeCancelNotice(): string | null {
    try {
      const storage = this.document.defaultView?.sessionStorage;
      const text = storage?.getItem(CANCEL_NOTICE_KEY) ?? null;
      storage?.removeItem(CANCEL_NOTICE_KEY);
      return text;
    } catch {
      return null;
    }
  }
}

function toRow(order: MyOrder): OrderRow {
  const pending = order.status === 'PENDING_PAYMENT';
  const items = order.items.map((item) => `${item.productName} × ${item.quantity}`);
  return {
    id: order.id,
    orderNo: order.orderNo,
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS[order.status] ?? order.status,
    paymentLabel: PAYMENT_TYPE_LABELS[order.paymentType ?? ''] ?? '未記錄',
    payableLabel: formatMoney(order.totalAmount),
    createdLabel: formatDateTime(order.createdAt),
    itemsLabel: items.join('、'),
    lines: order.items.map((item) => ({ name: item.productName, quantity: item.quantity })),
    totalQuantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
    steps: buildSteps(order.status),
    paymentStatusLabel: PAYMENT_STATUS_LABELS[order.paymentStatus ?? ''] ?? '未記錄',
    filterGroup: filterGroupOf(order.status),
    paymentNote:
      order.paymentStatus === 'REFUND_REQUIRED'
        ? '訂單取消後才收到付款，客服將為你辦理退款。'
        : pending && order.paymentStatus === 'FAILED'
          ? '上次付款沒有成功，可以重新付款。'
          : '',
    canCancel: pending,
    canPay: pending && order.paymentType === 'CREDIT_CARD',
  };
}

/** 後端 ProblemDetails.detail 已是可直接顯示的說明 */
function problemDetail(error: unknown, fallback: string): string {
  const detail = error instanceof HttpErrorResponse ? error.error?.detail : null;
  return typeof detail === 'string' && detail ? detail : fallback;
}
