import { Component, input, output } from '@angular/core';

export interface PillOption {
  label: string;
  active?: boolean;
  /** 是否停用（例如沒有符合資料的篩選選項），停用時不可點擊 */
  disabled?: boolean;
  /** 滑鼠停留提示文字（例如僅以圖示辨識的顯示模式切換鈕） */
  title?: string;
}

/**
 * 藥丸狀選項群組：以一組可點擊按鈕呈現互斥選項（例如排序、篩選價格區間、評價、付款方式、點數折抵方式等），
 * 依 variant 套用外觀樣式、依 layout 套用排列方向。
 */
@Component({
  selector: 'app-pill-group',
  imports: [],
  templateUrl: './pill-group.html',
  styleUrls: [
    './pill-group.scss',
  ],
})
export class PillGroup {
  /** 選項清單 */
  options = input<PillOption[]>([]);
  /** 對應排序／模式切換、篩選價格區間、評價篩選、付款方式、點數折抵方式等外觀差異 */
  variant = input<'default' | 'wide' | 'mono' | 'band' | 'filter' | 'review' | 'pay' | 'point'>('default');
  /** row：橫向排列；tabs：橫向排列但間距較窄，供標題列的分頁列與商品頁評價篩選列使用；column：直向排列，供側欄篩選面板使用 */
  layout = input<'row' | 'tabs' | 'column'>('row');

  /** 點擊某個選項時觸發，帶出該選項的索引值 */
  select = output<number>();
}
