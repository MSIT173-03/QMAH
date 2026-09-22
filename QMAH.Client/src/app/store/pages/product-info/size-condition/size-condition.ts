import { Component, input } from '@angular/core';
import { Panel } from '../../../component';

/** 商品頁 SIZE & CONDITION 面板：尺寸、商品狀態與量測說明 */
@Component({
  selector: 'app-size-condition',
  imports: [Panel],
  templateUrl: './size-condition.html',
  styleUrls: [
    './size-condition.scss',
  ],
})
export class SizeCondition {
  /** 尺寸／規格說明 */
  dims = input('');
  /** 原作尺寸；與明信片實體尺寸分列，避免把兩者混成一個欄位。 */
  artifactDims = input('');
  /** 商品狀態說明 */
  condition = input('');
  /** 尺寸量測說明（佔位資料，正式應由商品說明設定提供） */
  note = input('');

  /** 以下為面板的固定版面文字 */
  protected readonly panelLabel = 'SIZE & CONDITION';
  protected readonly dimsLabel = '明信片尺寸';
  protected readonly artifactDimsLabel = '文物原尺寸';
  protected readonly conditionLabel = '狀態';
}
