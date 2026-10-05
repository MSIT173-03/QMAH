import { Component, input } from '@angular/core';
import { Panel } from '../../../component';

/** 商品頁 SIZE 面板：明信片尺寸與文物原尺寸 */
@Component({
  selector: 'app-size-condition',
  imports: [Panel],
  templateUrl: './size-condition.html',
  styleUrl: './size-condition.scss',
})
export class SizeCondition {
  /** 尺寸／規格說明 */
  dims = input('');
  /** 原作尺寸；與明信片實體尺寸分列，避免把兩者混成一個欄位。 */
  artifactDims = input('');

  /** 以下為面板的固定版面文字 */
  protected readonly panelLabel = 'SIZE';
  protected readonly dimsLabel = '明信片尺寸';
  protected readonly artifactDimsLabel = '文物原尺寸';
}
