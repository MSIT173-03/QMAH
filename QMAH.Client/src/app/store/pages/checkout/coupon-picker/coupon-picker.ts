import { Component, computed, input, output } from '@angular/core';
import { Panel, SectionHead } from '../../../component';
import { Coupon } from '../../../api/api.models';
import { NO_COUPON } from '../checkout.data';

/**
 * 結帳頁的折價券面板。
 * 是否達到使用門檻由後端的訂單試算結果提供，可用張數與狀態文字由此推導；
 * 點選時只會發出「有效」的新選擇（再次點選已選用者代表取消，未達門檻者不觸發）。
 */
@Component({
  selector: 'app-coupon-picker',
  imports: [Panel, SectionHead],
  templateUrl: './coupon-picker.html',
  styleUrl: './coupon-picker.scss',
})
export class CouponPicker {
  /** 會員可選用的折價券清單 */
  coupons = input<Coupon[]>([]);
  /** 已達使用門檻的折價券 ID（後端試算） */
  usableIds = input<string[]>([]);
  /** 目前選用的折價券索引，NO_COUPON 代表未選用 */
  selected = input(NO_COUPON);

  /** 選用或取消折價券時觸發，帶出新的索引（NO_COUPON 代表取消選用） */
  select = output<number>();

  /** 折價券列的顯示資料：是否可用、是否已選用與右側狀態文字 */
  protected rows = computed(() =>
    this.coupons().map((coupon, i) => {
      const usable = this.usableIds().includes(coupon.id);
      const active = i === this.selected();
      return {
        off: coupon.off,
        title: coupon.title,
        cond: coupon.cond,
        usable,
        active,
        state: active ? '已選用' : usable ? '可使用' : '未達門檻',
      };
    }),
  );

  /** 目前達到使用門檻的折價券張數 */
  protected usableCount = computed(() => this.rows().filter((row) => row.usable).length);

  /** 點選折價券：已選用者取消選用，未達門檻者不做任何事 */
  protected pick(index: number): void {
    const row = this.rows()[index];
    if (row.active) {
      this.select.emit(NO_COUPON);
    } else if (row.usable) {
      this.select.emit(index);
    }
  }

  /** 以下為固定的版面文字 */
  protected readonly title = '折價券';
  protected readonly tag = 'COUPON';
}
