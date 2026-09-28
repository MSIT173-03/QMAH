import { Component, input } from '@angular/core';

/**
 * 通用面板容器：依 variant 套用不同外觀樣式，內容由使用端以 ng-content 投影。
 */
@Component({
  selector: 'app-panel',
  templateUrl: './panel.html',
  styleUrl: './panel.scss',
})
export class Panel {
  /** 面板外觀樣式變體 */
  variant = input<'default' | 'accent' | 'filter' | 'note' | 'size'>('default');
}
