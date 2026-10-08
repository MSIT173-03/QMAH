import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** 細節追跡與書畫拼貼共用的放大鏡設定：倍率 2–8 倍（滾輪連續調整、拉條有刻度）、鏡面三種大小，兩個玩法互相同步並記在這台瀏覽器。 */
export const LOUPE_MIN = 2;
export const LOUPE_MAX = 8;
export function clampZoom(value: number): number { return Math.round(Math.max(LOUPE_MIN, Math.min(LOUPE_MAX, value)) * 4) / 4; }
/** 滾輪連續調整倍率：往上滾放大、往下滾縮小，不必一格一格跳。 */
export function wheelZoom(zoom: number, deltaY: number): number { return clampZoom(zoom * Math.exp(-deltaY * .0015)); }
export const LOUPE_SIZES = [
  { id: 'small', label: '小', px: 112 },
  { id: 'medium', label: '中', px: 156 },
  { id: 'large', label: '大', px: 216 }
] as const;
export type LoupeSizeId = (typeof LOUPE_SIZES)[number]['id'];

export interface LoupePrefs { on: boolean; zoom: number; size: LoupeSizeId; }

const ZOOM_KEY = 'qmah.game.zoom';
const SIZE_KEY = 'qmah.game.loupe-size';
const ON_KEY = 'qmah.game.loupe-on';

function read(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
function write(key: string, value: string): void { try { localStorage.setItem(key, value); } catch { /* 無法儲存時只影響這次 */ } }

export function loadLoupePrefs(): LoupePrefs {
  const zoom = Number(read(ZOOM_KEY));
  const size = LOUPE_SIZES.find(item => item.id === read(SIZE_KEY))?.id ?? 'medium';
  return { on: read(ON_KEY) !== '0', zoom: zoom >= LOUPE_MIN && zoom <= LOUPE_MAX ? clampZoom(zoom) : 3, size };
}

export function saveLoupePrefs(prefs: Partial<LoupePrefs>): void {
  if (prefs.zoom !== undefined) write(ZOOM_KEY, String(prefs.zoom));
  if (prefs.size !== undefined) write(SIZE_KEY, prefs.size);
  if (prefs.on !== undefined) write(ON_KEY, prefs.on ? '1' : '0');
}

export function loupePixels(size: LoupeSizeId): number { return LOUPE_SIZES.find(item => item.id === size)?.px ?? 156; }

let controlsSequence = 0;

/** 放大鏡控制：「放大鏡」（開關與連續倍率拉條）與「鏡面大小」是各自獨立的一區。 */
@Component({
  selector: 'app-game-loupe-controls',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './game-loupe.scss',
  template: `
    <section class="loupe-group">
      <span class="loupe-label" [id]="id + '-zoom'">放大鏡</span>
      <div class="loupe-zoom" title="滑鼠滾輪也能調整倍率">
        <div class="loupe-seg loupe-seg--2" role="radiogroup" [attr.aria-labelledby]="id + '-zoom'">
          <button type="button" role="radio" [attr.aria-checked]="!on()" (click)="loupeChange.emit(0)">關</button>
          <button type="button" role="radio" [attr.aria-checked]="on()" (click)="loupeChange.emit(zoom())">開</button>
        </div>
        <input class="loupe-range" type="range" [min]="min" [max]="max" step="0.25" [attr.list]="id + '-ticks'" [value]="zoom()" aria-label="放大倍率" (input)="onRange($event)" />
        <datalist [id]="id + '-ticks'"><option value="2"></option><option value="4"></option><option value="6"></option><option value="8"></option></datalist>
        <output class="loupe-value">{{ zoom() }}×</output>
      </div>
      <small class="loupe-note">{{ on() ? '游標旁會浮出放大畫面，滾輪或拉條可調倍率（最高 8×）' : '放大鏡已關閉' }}</small>
    </section>
    <section class="loupe-group" [class.is-off]="!on()">
      <span class="loupe-label" [id]="id + '-size'">鏡面大小</span>
      <div class="loupe-seg loupe-seg--3" role="radiogroup" [attr.aria-labelledby]="id + '-size'">
        @for (item of sizes; track item.id) { <button type="button" role="radio" [attr.aria-checked]="size() === item.id" [disabled]="!on()" (click)="sizeChange.emit(item.id)">{{ item.label }}</button> }
      </div>
    </section>
  `
})
export class GameLoupeControlsComponent {
  readonly on = input.required<boolean>();
  readonly zoom = input.required<number>();
  readonly size = input.required<LoupeSizeId>();
  readonly loupeChange = output<number>();
  readonly sizeChange = output<LoupeSizeId>();
  protected readonly id = `loupe-${++controlsSequence}`;
  protected onRange(event: Event): void { this.loupeChange.emit(Number((event.target as HTMLInputElement).value)); }
  protected readonly min = LOUPE_MIN;
  protected readonly max = LOUPE_MAX;
  protected readonly sizes = LOUPE_SIZES;
}
