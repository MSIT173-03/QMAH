import { Component, signal } from '@angular/core';

/**
 * 頂部工具列（promobar）的懸浮面板：滑鼠移入觸發連結時展開面板，移出時收合。
 * 折價券與購物車共用同一套開關與動畫，使用時以 `panelTrigger` 屬性標出觸發連結，其餘內容投影進面板：
 *
 *   <app-promobar-panel>
 *     <a panelTrigger …>購物車</a>
 *     <a …>面板內的列</a>
 *   </app-promobar-panel>
 */
@Component({
  selector: 'app-promobar-panel',
  templateUrl: './promobar-panel.html',
  styleUrl: './promobar-panel.scss',
})
export class PromobarPanel {
  /** 面板是否展開 */
  protected readonly open = signal(false);
}
