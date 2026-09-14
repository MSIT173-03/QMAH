import { Component, computed, input, output } from '@angular/core';
import { Panel, SectionHead, PillGroup, PillOption } from '../../../component';
import { formatNumber } from '../../../shared/format';
import { PointMode, POINT_MODES } from '../checkout.data';

/**
 * 結帳頁的購物點數折抵面板。
 * 可折抵上限與實際折抵點數皆來自後端的訂單試算結果，本元件只負責顯示與回報折抵方式、自訂點數。
 */
@Component({
  selector: 'app-point-picker',
  imports: [Panel, SectionHead, PillGroup],
  templateUrl: './point-picker.html',
  styleUrls: [
    './point-picker.scss',
  ],
})
export class PointPicker {
  /** 會員目前持有的點數 */
  balance = input(0);
  /** 本次可折抵點數上限（後端試算） */
  cap = input(0);
  /** 實際折抵點數（後端試算） */
  used = input(0);
  /** 目前的折抵方式 */
  mode = input<PointMode>('none');
  /** 自訂折抵的輸入內容（僅含數字字元） */
  customPoints = input('');

  /** 切換折抵方式時觸發 */
  modeChange = output<PointMode>();
  /** 自訂折抵數量變更時觸發，帶出濾除非數字後的內容 */
  customPointsChange = output<string>();

  /** 是否顯示自訂折抵輸入列 */
  protected showCustom = computed(() => this.mode() === 'custom');

  /** 折抵方式的藥丸按鈕選項；「折抵至上限」的文字依持有點數是否足夠而不同 */
  protected modeOptions = computed<PillOption[]>(() =>
    POINT_MODES.map((mode) => ({ label: this.modeLabel(mode), active: mode === this.mode() })),
  );

  /** 持有點數顯示文字 */
  protected balanceLabel = computed(() => formatNumber(this.balance()));
  /** 可折抵上限顯示文字 */
  protected capLabel = computed(() => formatNumber(this.cap()));
  /** 實際折抵點數顯示文字 */
  protected usedLabel = computed(() => formatNumber(this.used()));

  /** 以下為固定的版面文字 */
  protected readonly title = '購物點數';
  protected readonly tag = 'POINTS';
  protected readonly customLabel = '自訂折抵';
  protected readonly customPlaceholder = '0';

  /** 依索引切換折抵方式 */
  protected onModePick(index: number): void {
    this.modeChange.emit(POINT_MODES[index]);
  }

  /** 自訂折抵只接受數字，輸入其他字元時直接濾除並同步回輸入框 */
  protected onCustomInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const digits = target.value.replace(/[^0-9]/g, '');
    if (target.value !== digits) target.value = digits;
    this.customPointsChange.emit(digits);
  }

  /** 各折抵方式的按鈕文字 */
  private modeLabel(mode: PointMode): string {
    if (mode === 'none') return '不使用';
    if (mode === 'custom') return '自訂數量';
    // 上限等於持有點數代表點數可全額折抵；否則上限即為應付商品金額，改標示可折抵的應付金額
    return this.cap() === this.balance()
      ? `點數全額 ${this.balanceLabel()} 點`
      : `折抵應付金額 ${this.capLabel()} 點`;
  }
}
