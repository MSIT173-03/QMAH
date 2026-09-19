import { Component, computed, input } from '@angular/core';
import { pad } from '../../shared/format';

/**
 * 流程步驟指示器（例如結帳流程的「01 購物車 — 02 結帳 — 03 完成」）。
 * 投影於 app-site-header 內使用，靠 margin-left: auto 推擠至頁首右側。
 */
@Component({
  selector: 'app-step-indicator',
  imports: [],
  templateUrl: './step-indicator.html',
  styleUrls: [
    './step-indicator.scss',
  ],
})
export class StepIndicator {
  /** 步驟名稱清單，順序即流程順序；兩位數序號由本元件依索引推導，不需由外部帶入 */
  steps = input<string[]>([]);
  /** 目前所在步驟的索引；索引之前為已完成、之後為尚未進行 */
  current = input(0);

  /** 顯示用步驟資料：補上兩位數序號並標記已完成／進行中 */
  protected items = computed(() =>
    this.steps().map((label, i) => ({
      label: `${pad(i + 1)} ${label}`,
      done: i < this.current(),
      current: i === this.current(),
    })),
  );
}
