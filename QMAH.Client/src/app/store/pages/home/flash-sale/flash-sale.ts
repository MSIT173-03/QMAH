import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { interval, map } from 'rxjs';
import { Panel } from '../../../component';
import { HomeApi } from '../../../api';
import { formatMoney, pad } from '../../../shared/format';
import { LucidePackageSearch } from '@lucide/angular';

/** 首頁側欄的限時特賣面板：倒數計時搭配特賣品項清單 */
@Component({
  selector: 'app-flash-sale',
  imports: [Panel, LucidePackageSearch],
  templateUrl: './flash-sale.html',
  styleUrls: [
    './flash-sale.scss',
  ],
})
export class FlashSale {
  /** 限時特賣資料（結束時間與品項） */
  private readonly sale = toSignal(inject(HomeApi).getFlashSale());

  /** 特賣品項顯示資料 */
  protected items = computed(() =>
    (this.sale()?.items ?? []).map((item) => ({
      name: item.name,
      price: formatMoney(item.price),
      was: formatMoney(item.originalPrice),
      /** 剩餘庫存比例，用於進度條寬度 */
      left: `${Math.round(item.stockRatio * 100)}%`,
    })),
  );

  /** 目前時間，每秒更新一次以驅動倒數計時（元件銷毀時自動停止） */
  private now = toSignal(interval(1000).pipe(map(() => Date.now())), { initialValue: Date.now() });
  /** 距離特賣結束的剩餘秒數 */
  private remainingSecs = computed(() => {
    const endsAt = this.sale()?.endsAt;
    return endsAt ? Math.max(0, Math.ceil((Date.parse(endsAt) - this.now()) / 1000)) : 0;
  });
  /** 依剩餘秒數換算的 HH:MM:SS 顯示文字 */
  protected countdownLabel = computed(() => {
    const secs = this.remainingSecs();
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  });
}
