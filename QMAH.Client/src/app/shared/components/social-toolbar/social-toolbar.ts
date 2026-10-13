import { ChangeDetectionStrategy, Component, computed, inject, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideCalendarRange, LucideChevronDown, LucideColumns2, LucideColumns3, LucideFoldHorizontal,
  LucideSearch, LucideSquare, LucideUnfoldHorizontal, LucideX,
} from '@lucide/angular';
import { SocialViewPreferences } from '../../../core/services/social-view-preferences';

/** 日期快速選項：from／to 是相對今天的天數（負數為過去），null 表示不限。 */
export interface DatePreset { label: string; from: number | null; to: number | null }

export const PAST_DATE_PRESETS: DatePreset[] = [
  { label: '不限', from: null, to: null },
  { label: '今天', from: 0, to: 0 },
  { label: '近 7 天', from: -6, to: 0 },
  { label: '近 30 天', from: -29, to: 0 },
];

export const UPCOMING_DATE_PRESETS: DatePreset[] = [
  { label: '不限', from: null, to: null },
  { label: '今天', from: 0, to: 0 },
  { label: '未來 7 天', from: 0, to: 6 },
  { label: '未來 30 天', from: 0, to: 29 },
];

function ymd(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * 社群頁面共用工具列：搜尋、日期快速篩選（含自訂起迄）、每列幾欄、寬版／標準。
 * 貼文牆、公告、活動三個頁面同一組，位置與樣式一致；查詢條件改變時發出 searched，由頁面自己重新載入。
 */
@Component({
  selector: 'app-social-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideCalendarRange, LucideChevronDown, LucideColumns2, LucideColumns3, LucideFoldHorizontal, LucideSearch, LucideSquare, LucideUnfoldHorizontal, LucideX],
  styleUrl: './social-toolbar.scss',
  template: `
    <div class="bar" role="search">
      <label class="box">
        <svg lucideSearch aria-hidden="true" focusable="false"></svg>
        <span class="sr-only">{{ placeholder() }}</span>
        <input type="search" name="social-toolbar-search" autocomplete="off" [placeholder]="placeholder() + '，按 Enter 搜尋'" [ngModel]="keyword()" (ngModelChange)="keyword.set($event)" (keyup.enter)="searched.emit()" />
        @if (keyword()) {
          <button type="button" class="box__clear" aria-label="清除關鍵字" (click)="keyword.set(''); searched.emit()"><svg lucideX aria-hidden="true" focusable="false"></svg></button>
        }
      </label>
      <div class="date">
        <button type="button" class="tool" [class.is-on]="hasDate() || open()" [attr.aria-expanded]="open()" aria-haspopup="dialog" (click)="open.set(!open())">
          <svg lucideCalendarRange aria-hidden="true" focusable="false"></svg>
          <span>{{ dateText() }}</span>
          <svg class="tool__caret" lucideChevronDown aria-hidden="true" focusable="false"></svg>
        </button>
        @if (open()) {
          <div class="panel" role="dialog" [attr.aria-label]="dateLabel()">
            <div class="panel__presets">
              @for (preset of presets(); track preset.label) {
                <button type="button" class="panel__preset" [class.is-active]="activePreset() === preset.label" (click)="applyPreset(preset)">{{ preset.label }}</button>
              }
            </div>
            <label class="panel__field"><span>從</span><input type="date" [ngModel]="from()" [max]="to() || null" (ngModelChange)="setRange($event, to())" /></label>
            <label class="panel__field"><span>到</span><input type="date" [ngModel]="to()" [min]="from() || null" (ngModelChange)="setRange(from(), $event)" /></label>
          </div>
        }
      </div>
      @if (showCols()) {
        <div class="cols" role="group" aria-label="每列數量">
          <button type="button" class="cols__btn" [class.is-active]="cols() === 1" [attr.aria-pressed]="cols() === 1" title="一欄" aria-label="每列一個" (click)="cols.set(1)"><svg lucideSquare aria-hidden="true" focusable="false"></svg></button>
          <button type="button" class="cols__btn" [class.is-active]="cols() === 2" [attr.aria-pressed]="cols() === 2" title="兩欄" aria-label="每列兩個" (click)="cols.set(2)"><svg lucideColumns2 aria-hidden="true" focusable="false"></svg></button>
          <button type="button" class="cols__btn cols__btn--wide" [class.is-active]="cols() === 3" [attr.aria-pressed]="cols() === 3" title="三欄" aria-label="每列三個" (click)="cols.set(3)"><svg lucideColumns3 aria-hidden="true" focusable="false"></svg></button>
        </div>
      }
      <button type="button" class="tool tool--width" [class.is-on]="view.wide()" [attr.aria-pressed]="view.wide()" (click)="view.toggle()">
        @if (view.wide()) { <svg lucideFoldHorizontal aria-hidden="true" focusable="false"></svg> } @else { <svg lucideUnfoldHorizontal aria-hidden="true" focusable="false"></svg> }
        <span>{{ view.wide() ? '寬版' : '標準' }}</span>
      </button>
    </div>
  `,
})
export class SocialToolbarComponent {
  protected readonly view = inject(SocialViewPreferences);

  readonly placeholder = input('搜尋標題或內容');
  readonly dateLabel = input('日期');
  readonly presets = input<DatePreset[]>(PAST_DATE_PRESETS);
  readonly showCols = input(true);

  readonly keyword = model('');
  readonly from = model('');
  readonly to = model('');
  readonly cols = model<1 | 2 | 3>(2);
  readonly searched = output<void>();

  protected readonly open = signal(false);
  protected readonly activePreset = signal('');
  protected readonly hasDate = computed(() => !!(this.from() || this.to()));
  protected readonly dateText = computed(() =>
    !this.hasDate() ? this.dateLabel() : this.activePreset() || `${this.from() || '…'} ～ ${this.to() || '…'}`);

  protected applyPreset(preset: DatePreset): void {
    this.activePreset.set(preset.from === null && preset.to === null ? '' : preset.label);
    this.from.set(preset.from === null ? '' : ymd(preset.from));
    this.to.set(preset.to === null ? '' : ymd(preset.to));
    this.open.set(false);
    this.searched.emit();
  }

  protected setRange(from: string, to: string): void {
    this.activePreset.set('');
    this.from.set(from);
    this.to.set(to);
    this.searched.emit();
  }
}
