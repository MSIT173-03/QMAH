import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { LucideX } from '@lucide/angular';
import { catchError, of, switchMap } from 'rxjs';

import { Breadcrumb, BreadcrumbItem, CouponRedeemDialog, EmptyState, PageTitleRow, SessionBar } from '../../component';
import { CouponApi } from '../../api';
import { HOME_PATH } from '../../shared/paths';
import { injectCartState } from '../../shared/page-state';
import { formatNumber } from '../../shared/format';

/** 兌換成功後頁面會重新整理，結果訊息暫存在 sessionStorage，等重新載入完成後再顯示 */
const REDEEM_NOTICE_KEY = 'qmah.store.couponRedeemNotice';

/** 兌換成功訊息自動消失前的停留時間（毫秒） */
const FEEDBACK_AUTO_DISMISS_MS = 10_000;
/** 訊息淡出的時間（毫秒），需與 coupon-store.scss 的 .coupon-feedback 過渡時間一致 */
const FEEDBACK_FADE_MS = 300;

/**
 * 折價券商店頁面：列出目前可用點數兌換的折價券（GET /store/coupons，後端已篩選啟用、期間內且有兌換點數者）。
 * 按下券面右側的點數區塊即兌換：未登入先跳出登入提示，已登入則先跳出確認視窗，
 * 確認後呼叫 POST /store/coupons/{id}/redeem（點數檢查、扣點與發券都在後端同一個交易內完成）。
 */
@Component({
  selector: 'app-coupon-store',
  host: { class: 'store-app' },
  imports: [SessionBar, Breadcrumb, PageTitleRow, EmptyState, CouponRedeemDialog, LucideX],
  templateUrl: './coupon-store.html',
  styleUrl: './coupon-store.scss',
})
export class CouponStore {
  private readonly couponApi = inject(CouponApi);
  private readonly document = inject(DOCUMENT);

  /** 頁面持有的購物車狀態，供頂部公告列顯示與登入提示共用 */
  protected readonly cart = injectCartState();

  /** 麵包屑導覽項目 */
  protected readonly breadcrumbItems: BreadcrumbItem[] = [{ label: '首頁', href: HOME_PATH }, { label: '折價券商店' }];

  /** 按下「重新載入」的次數，變動時重新查詢 */
  private readonly reloadCount = signal(0);
  /** 最近一次查詢是否失敗；失敗時顯示錯誤狀態，而不是「目前沒有可兌換的折價券」 */
  protected readonly loadError = signal(false);

  /** 可兌換的折價券；undefined 代表尚在載入，null 代表查詢失敗 */
  private readonly result = toSignal(
    toObservable(this.reloadCount).pipe(
      switchMap(() => {
        this.loadError.set(false);
        return this.couponApi.getStoreCoupons().pipe(
          catchError(() => {
            this.loadError.set(true);
            return of(null);
          }),
        );
      }),
    ),
  );

  protected readonly loading = computed(() => this.result() === undefined);
  /** 供模板顯示的折價券，點數與期限已換算成顯示文字 */
  protected readonly coupons = computed(() =>
    (this.result() ?? []).map((coupon) => ({
      ...coupon,
      costLabel: `${formatNumber(coupon.pointCost)} 點`,
      validityLabel: `兌換後 ${coupon.validityDays} 天內有效`,
      endLabel: `${coupon.endDate} 前可兌換`,
    })),
  );
  protected readonly isEmpty = computed(() => !!this.result() && this.coupons().length === 0);
  protected readonly countLabel = computed(() => `${this.coupons().length} 張折價券`);

  /** 固定的版面文字 */
  protected readonly emptyTitle = '目前沒有可兌換的折價券';
  protected readonly emptyDesc = '折價券會依活動期間開放兌換，稍後再來看看。';
  protected readonly errorTitle = '折價券資料暫時無法載入';
  protected readonly errorDesc = '伺服器目前沒有回應，請稍後再試。';
  protected readonly errorCtaLabel = '重新載入';
  /** 所需點數上方的動作字樣 */
  protected readonly costActionLabel = '兌換';

  /** 登入提示的說明文字（兌換需要登入） */
  protected readonly loginMessage = '兌換折價券需要先登入會員，是否前往登入頁？登入後會回到目前頁面。';

  /* ===============================
     兌換流程
     =============================== */

  /** 等待使用者確認兌換的折價券；null 代表確認視窗關閉 */
  protected readonly pendingCoupon = signal<{ id: string; title: string; costLabel: string } | null>(null);

  /** 兌換請求進行中 */
  protected readonly redeeming = signal(false);
  /** 最近一次兌換的結果訊息；成功與失敗各自以不同樣式呈現 */
  protected readonly feedback = signal<{ kind: 'success' | 'error'; text: string } | null>(null);
  /** 訊息正在淡出：套用淡出樣式，淡出結束才真正移除 */
  protected readonly feedbackLeaving = signal(false);
  /** 訊息右側關閉鈕的無障礙名稱 */
  protected readonly closeLabel = '關閉訊息';
  /** 淡出結束前尚未執行的移除計時器 */
  private fadeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // 兌換成功後頁面重新整理過一次：讀回暫存的結果訊息，由模板等清單載入完成後才顯示。
    const notice = this.takeRedeemNotice();
    if (notice) this.feedback.set({ kind: 'success', text: notice });

    // 成功訊息顯示 10 秒後自動淡出（清單載入完成、訊息真正顯示出來才開始計時）；錯誤訊息保留到使用者關閉。
    effect((onCleanup) => {
      if (this.loading() || this.feedback()?.kind !== 'success') return;
      const timer = setTimeout(() => this.dismissFeedback(), FEEDBACK_AUTO_DISMISS_MS);
      onCleanup(() => clearTimeout(timer));
    });
    inject(DestroyRef).onDestroy(() => this.clearFadeTimer());
  }

  /** 按下券面的點數區塊：未登入開啟登入提示，已登入開啟兌換確認 */
  protected onRedeemClick(coupon: { id: string; title: string; costLabel: string }): void {
    this.clearFeedback();
    this.cart.requireSignIn(() => this.pendingCoupon.set(coupon));
  }

  /** 立刻淡出並移除訊息（自動消失與按叉號共用）；淡出期間重複呼叫不會重複計時 */
  protected dismissFeedback(): void {
    if (!this.feedback() || this.feedbackLeaving()) return;
    this.feedbackLeaving.set(true);
    this.fadeTimer = setTimeout(() => this.clearFeedback(), FEEDBACK_FADE_MS);
  }

  /** 直接清除訊息與淡出狀態 */
  private clearFeedback(): void {
    this.clearFadeTimer();
    this.feedback.set(null);
    this.feedbackLeaving.set(false);
  }

  private clearFadeTimer(): void {
    if (this.fadeTimer !== null) clearTimeout(this.fadeTimer);
    this.fadeTimer = null;
  }

  /** 兌換確認視窗按下「取消」 */
  protected onRedeemCancel(): void {
    this.pendingCoupon.set(null);
  }

  /** 兌換確認視窗按下「確認兌換」：以折價券 Id 呼叫後端，並依結果顯示訊息 */
  protected onRedeemConfirm(): void {
    const coupon = this.pendingCoupon();
    if (!coupon || this.redeeming()) return;

    this.redeeming.set(true);
    this.couponApi.redeemStoreCoupon(coupon.id).subscribe({
      next: (result) => {
        // 兌換成功：直接重新整理頁面，讓頂部公告列的點數與折價券張數也跟著更新；
        // 確認視窗維持「兌換中…」直到頁面重新載入，結果訊息則暫存起來，載入完成後再顯示。
        this.saveRedeemNotice(
          `已兌換「${result.name}」，扣除 ${formatNumber(result.pointCost)} 點，剩餘 ${formatNumber(result.remainingPoints)} 點。`,
        );
        this.reloadPage();
      },
      error: (error: unknown) => {
        this.redeeming.set(false);
        this.pendingCoupon.set(null);
        if (error instanceof HttpErrorResponse && error.status === 401) {
          // 登入已失效：清除登入狀態並改為詢問是否重新登入。
          this.cart.handleUnauthorized();
          return;
        }
        // 後端的 ProblemDetails.detail 已是可直接顯示的說明（例如「鑑定點數不足」）。
        const detail = error instanceof HttpErrorResponse ? error.error?.detail : null;
        this.feedback.set({ kind: 'error', text: typeof detail === 'string' && detail ? detail : '兌換失敗，請稍後再試。' });
      },
    });
  }

  /** 查詢失敗後重新查詢 */
  protected onReload(): void {
    this.reloadCount.update((count) => count + 1);
  }

  /** 重新整理頁面（獨立成方法，測試時可以替換掉） */
  protected reloadPage(): void {
    this.document.defaultView?.location.reload();
  }

  /** 暫存兌換成功的訊息；sessionStorage 不可用（例如隱私模式）時略過，只是重新整理後看不到訊息 */
  private saveRedeemNotice(text: string): void {
    try {
      this.document.defaultView?.sessionStorage.setItem(REDEEM_NOTICE_KEY, text);
    } catch {
      // 訊息只是輔助資訊，不影響兌換結果。
    }
  }

  /** 取出（並移除）暫存的兌換成功訊息；沒有時回傳 null */
  private takeRedeemNotice(): string | null {
    try {
      const storage = this.document.defaultView?.sessionStorage;
      const text = storage?.getItem(REDEEM_NOTICE_KEY) ?? null;
      storage?.removeItem(REDEEM_NOTICE_KEY);
      return text;
    } catch {
      return null;
    }
  }
}
