import { Component, input, model } from '@angular/core';

/**
 * 數量調整元件：提供加減按鈕調整數量（雙向綁定），並可設定最小／最大可選數量限制。
 */
@Component({
  selector: 'app-qty-stepper',
  imports: [],
  templateUrl: './qty-stepper.html',
  styleUrls: [
    './qty-stepper.scss',
  ],
})
export class QtyStepper {
  /** 目前數量（雙向綁定） */
  value = model(1);
  /** 最小可選數量 */
  min = input(1);
  /** 最大可選數量，為 null 時不限制上限 */
  max = input<number | null>(null);
  /** 購物車行內使用的縮小版 */
  size = input<'default' | 'sm'>('default');

  /** 數量減一，不低於 min */
  protected dec() {
    this.value.update((v) => Math.max(this.min(), v - 1));
  }

  /** 數量加一，若有設定 max 則不超過上限 */
  protected inc() {
    const max = this.max();
    this.value.update((v) => (max === null ? v + 1 : Math.min(max, v + 1)));
  }
}
