import { Component, computed, input, output } from '@angular/core';
import { Panel } from '../../../component/panel/panel';
import { SectionHead } from '../../../component/section-head/section-head';
import { PillGroup, PillOption } from '../../../component/pill-group/pill-group';
import { PointMode, POINT_MODES, pointCap, resolveUsedPoints } from '../checkout.data';

/**
 * 結帳頁的購物點數折抵面板。
 * 可折抵上限與實際折抵點數皆由持有點數、應付金額與折抵方式推導，
 * 不需由頁面另外傳入（頁面以同一組 checkout.data 的純函式換算總額）。
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
  /** 目前應付商品金額，與持有點數取小者即為本次折抵上限 */
  payable = input(0);
  /** 目前的折抵方式 */
  mode = input<PointMode>('none');
  /** 自訂折抵的輸入內容（僅含數字字元） */
  customPoints = input('');

  /** 切換折抵方式時觸發 */
  modeChange = output<PointMode>();
  /** 自訂折抵數量變更時觸發，帶出濾除非數字後的內容 */
  customPointsChange = output<string>();

  /** 本次可折抵上限：持有點數與應付金額取小者 */
  protected cap = computed(() => pointCap(this.balance(), this.payable()));
  /** 依折抵方式換算的實際折抵點數 */
  protected used = computed(() => resolveUsedPoints(this.mode(), this.customPoints(), this.cap()));
  /** 是否顯示自訂折抵輸入列 */
  protected showCustom = computed(() => this.mode() === 'custom');

  /** 折抵方式的藥丸按鈕選項；「折抵至上限」的文字依持有點數是否足夠而不同 */
  protected modeOptions = computed<PillOption[]>(() =>
    POINT_MODES.map((mode) => ({ label: this.modeLabel(mode), active: mode === this.mode() })),
  );

  /** 持有點數顯示文字 */
  protected balanceLabel = computed(() => this.balance().toLocaleString('en-US'));
  /** 可折抵上限顯示文字 */
  protected capLabel = computed(() => this.cap().toLocaleString('en-US'));
  /** 實際折抵點數顯示文字 */
  protected usedLabel = computed(() => this.used().toLocaleString('en-US'));

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
    // 持有點數不足以折抵全部應付金額時，改標示可折抵的應付金額
    return this.balance() <= this.payable()
      ? `點數全額 ${this.balanceLabel()} 點`
      : `折抵應付金額 ${this.payable().toLocaleString('en-US')} 點`;
  }
}
