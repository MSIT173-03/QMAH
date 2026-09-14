import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Panel } from '../../../component/panel/panel';
import { HomeApi } from '../../../api/home.api';

/** 首頁側欄的迷你折價券面板：可點擊領取，領取後按鈕樣式與文字改變 */
@Component({
  selector: 'app-mini-coupons',
  imports: [Panel],
  templateUrl: './mini-coupons.html',
  styleUrls: [
    './mini-coupons.scss',
  ],
})
export class MiniCoupons {
  /** 可領取的折價券 */
  private readonly coupons = toSignal(inject(HomeApi).getClaimableCoupons(), { initialValue: [] });

  /** 折價券的領取狀態（索引對應 coupons） */
  protected takenCoupons = signal<Record<number, boolean>>({});
  /** 折價券顯示資料，依領取狀態換算按鈕文字 */
  protected displayCoupons = computed(() =>
    this.coupons().map((coupon, i) => ({
      off: coupon.off,
      cond: coupon.cond,
      taken: !!this.takenCoupons()[i],
    })),
  );

  /** 領取指定索引的折價券 */
  protected take(index: number): void {
    this.takenCoupons.update((v) => ({ ...v, [index]: true }));
  }
}
