import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { CouponApi } from '../../../../store/api';
import { StoreCoupon } from '../../../../store/api/api.models';
import { COUPON_STORE_PATH } from '../../../../store/shared/paths';
import { problemDetail } from '../../../../store/shared/problem-detail';
import { QmahIconComponent } from '../../../../shared/components/qmah-icon/qmah-icon';

/** 兌換成功後停留多久再帶到商城（毫秒），讓會員看得到結果 */
const REDIRECT_DELAY_MS = 1600;

/**
 * 會員中心內嵌的折價券兌換：與商城「兌換商店」同一組 API（GET /store/coupons、POST /store/coupons/{id}/redeem）。
 * 點數不足的券變灰；按「兌換」先在券面上確認，成功後顯示結果並自動帶到商城的折價券頁，直接去使用。
 */
@Component({
  selector: 'app-coupon-exchange',
  imports: [QmahIconComponent, RouterLink],
  template: `
    <section class="exchange">
      <header class="exchange-head">
        <span class="exchange-icon"><app-qmah-icon name="ticket" [size]="20" aria-hidden="true" /></span>
        <span class="exchange-titles">
          <h2>折價券兌換</h2>
          <p>用鑑定點數換折價券，換完會帶你到商城直接使用。</p>
        </span>
        <span class="exchange-balance">可用 <strong>{{ balance() }}</strong> 點</span>
      </header>

      @if (message(); as m) {
        <p class="exchange-message" [class.is-error]="m.kind === 'error'" [attr.role]="m.kind === 'error' ? 'alert' : 'status'">{{ m.text }}</p>
      }

      @if (coupons() === null) {
        <p class="exchange-empty">正在整理折價券…</p>
      } @else if (coupons()!.length === 0) {
        <p class="exchange-empty">目前沒有可兌換的折價券。</p>
      } @else {
        <ul class="exchange-grid">
          @for (coupon of visible(); track coupon.id) {
            <li class="exchange-card" [class.is-locked]="coupon.pointCost > balanceValue()">
              <span class="exchange-off">{{ coupon.off }}</span>
              <span class="exchange-body">
                <strong>{{ coupon.title }}</strong>
                <small>{{ coupon.cond }}・兌換後 {{ coupon.validityDays }} 天內有效</small>
              </span>
              @if (confirming() === coupon.id) {
                <span class="exchange-confirm">
                  <button type="button" class="is-go" [disabled]="busy()" (click)="redeem(coupon)">{{ busy() ? '兌換中…' : '確認' }}</button>
                  <button type="button" [disabled]="busy()" (click)="confirming.set(null)">取消</button>
                </span>
              } @else {
                <button type="button" class="exchange-cost" [disabled]="coupon.pointCost > balanceValue() || busy()" (click)="confirming.set(coupon.id)">
                  <small>{{ coupon.pointCost > balanceValue() ? '點數不足' : '兌換' }}</small>
                  <strong>{{ coupon.pointCost }} 點</strong>
                </button>
              }
            </li>
          }
        </ul>
      }
      <a class="exchange-more" [routerLink]="storePath">到商城兌換商店看全部 {{ coupons()?.length ?? 0 }} 種折價券 →</a>
    </section>
  `,
  styleUrl: './coupon-exchange.scss',
})
export class CouponExchange {
  private readonly api = inject(CouponApi);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** 目前持有的鑑定點數 */
  readonly points = input<number>(0);
  /** 兌換成功（帶出扣除後的點數餘額） */
  readonly redeemed = output<number>();

  protected readonly coupons = signal<StoreCoupon[] | null>(null);
  protected readonly confirming = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly message = signal<{ kind: 'success' | 'error'; text: string } | null>(null);
  private readonly remaining = signal<number | null>(null);

  protected readonly balanceValue = computed(() => this.remaining() ?? this.points());
  protected readonly storePath = COUPON_STORE_PATH;
  /** 精簡版只列 4 張：買得起的排前面（由低到高），其餘（點數不足）接在後面，完整清單在商城兌換商店 */
  protected readonly visible = computed(() => {
    const list = this.coupons() ?? [];
    const points = this.balanceValue();
    const affordable = list.filter((c) => c.pointCost <= points);
    const locked = list.filter((c) => c.pointCost > points);
    return [...affordable, ...locked].slice(0, 4);
  });
  protected readonly balance = computed(() => this.balanceValue().toLocaleString('en-US'));

  constructor() {
    this.api
      .getStoreCoupons()
      .pipe(catchError(() => of([] as StoreCoupon[])))
      .subscribe((list) => this.coupons.set([...list].sort((a, b) => a.pointCost - b.pointCost)));
  }

  protected redeem(coupon: StoreCoupon): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.api.redeemStoreCoupon(coupon.id).subscribe({
      next: (result) => {
        this.busy.set(false);
        this.confirming.set(null);
        this.remaining.set(result.remainingPoints);
        this.redeemed.emit(result.remainingPoints);
        this.message.set({ kind: 'success', text: `已兌換「${result.name}」，扣除 ${result.pointCost} 點。正在帶你到商城使用…` });
        const timer = setTimeout(() => void this.router.navigateByUrl(COUPON_STORE_PATH), REDIRECT_DELAY_MS);
        this.destroyRef.onDestroy(() => clearTimeout(timer));
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.confirming.set(null);
        const text = error instanceof HttpErrorResponse && error.status === 401 ? '登入已失效，請重新登入。' : problemDetail(error, '兌換失敗，請稍後再試。');
        this.message.set({ kind: 'error', text });
      },
    });
  }
}
