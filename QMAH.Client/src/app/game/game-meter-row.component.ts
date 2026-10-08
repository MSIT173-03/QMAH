import { QmahIconComponent } from '../shared/components/qmah-icon/qmah-icon';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface MeterRow { label: string; text: string; base: number; gain: number; tag: number; tone: 'points' | 'keys'; now: number; max: number; }

/** 一條進度：標籤、數值與分段槽；獎勵面板的標頭與詳情共用。 */
@Component({
  imports: [QmahIconComponent],
  selector: 'app-game-meter-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-tone]': 'row().tone' },
  template: `
    <span class="mrow-head"><span class="mrow-label">@if (row().tone === 'keys') {<app-qmah-icon class="meter-icon" name="key-round" aria-hidden="true" />} @else {<app-qmah-icon class="meter-icon" name="coins" aria-hidden="true" />}{{ row().label }}</span><span class="mrow-value">{{ row().text }}@if (row().tag > 0) { <b class="meter-gain-tag">本局 +{{ row().tag }}</b> }</span></span>
    <span class="mbar" role="progressbar" [attr.aria-label]="row().label" aria-valuemin="0" [attr.aria-valuemax]="row().max" [attr.aria-valuenow]="row().now">
      <span class="mbar-fill" [style.transform]="'scaleX(' + row().base / 100 + ')'"></span>
      @if (row().gain > 0) { <span class="mbar-gain" [style.left.%]="row().base" [style.width.%]="row().gain"></span> }
      <span class="mbar-ticks"></span>
    </span>
  `,
  styleUrl: './game-meter-row.component.scss'
})
export class GameMeterRowComponent {
  readonly row = input.required<MeterRow>();
}
