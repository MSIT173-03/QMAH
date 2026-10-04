import { Component, ElementRef, ViewChild, computed, effect, inject, input, output, signal } from '@angular/core';
import { GameAudio } from './game-audio.service';

export function scrollGeometry(width: number, height: number) {
  const ratio = width > 0 && height > 0 ? width / height : 5 / 3;
  const horizontal = ratio >= 1;
  return { horizontal, ratio, eligible: ratio >= .5 && ratio <= 2.2, columns: horizontal ? 5 : 3, rows: horizontal ? 3 : 5 };
}

@Component({
  selector: 'app-game-scroll-board',
  template: `
    <div class="scroll-workbench" [style.--scroll-ratio]="layout().ratio">
      @if (ready() && !layout().eligible) {
        <p role="alert">這幅書畫比例不適合十五格復位，請返回選單重新選題。原圖不會被裁切或拉伸。</p>
      } @else if (!image() || failed()) {
        <div class="scroll-error" role="alert"><p>書畫圖片暫時無法顯示，復位進度仍保留。</p><button type="button" (click)="retryImage()">重新載入圖片</button></div>
      } @else {
        @for (revision of [imageRevision()]; track revision) {
          <img class="scroll-source" [src]="image()" alt="" aria-hidden="true" (load)="readDimensions($event)" (error)="onImageError()" />
        }
        <div class="relay" [style.--cols]="layout().columns" [style.--tile-ratio]="tileRatio()">
          <div class="relay-board" role="img" [attr.aria-label]="'長卷已接回 ' + filled() + ' ／ 15 片'">
            @for (slot of slots; track slot) {
              <span class="relay-slot" [class.is-filled]="slot < filled()" [class.is-next]="slot === filled() && !solved()">
                @if (slot < filled()) { <span class="relay-tile" [class.is-new]="slot === filled() - 1"><img [src]="image()" alt="" [style.width.%]="layout().columns * 100" [style.height.%]="layout().rows * 100" [style.left.%]="-(slot % layout().columns) * 100" [style.top.%]="-rowOf(slot) * 100" /></span> }
                @else { <b>{{ slot + 1 }}</b> }
              </span>
            }
          </div>
          <div class="relay-choices" data-no-sound role="group" [attr.aria-label]="solved() ? '長卷已完成' : '第 ' + (filled() + 1) + ' 片，選出接得上的一塊'">
            @if (solved()) { <p class="relay-done">長卷接回來了</p> } @else {
              <p class="relay-ask"><strong>第 {{ filled() + 1 }} 片是哪一塊？</strong><span>看邊緣的筆墨與景物接不接得上。</span></p>
              @for (piece of choices(); track piece; let index = $index) {
                <button type="button" class="relay-choice" [class.is-wrong]="wrong().includes(piece)" [class.is-hint]="hinted() && piece === filled()" [disabled]="disabled() || !ready() || wrong().includes(piece)" [attr.aria-label]="'候選 ' + (index + 1)" (click)="pick(piece)">
                  <span class="relay-tile"><img [src]="image()" alt="" [style.width.%]="layout().columns * 100" [style.height.%]="layout().rows * 100" [style.left.%]="-(piece % layout().columns) * 100" [style.top.%]="-rowOf(piece) * 100" /></span>
                </button>
              }
            }
            <div class="scroll-reference"><button type="button" (click)="openReference()" aria-haspopup="dialog">放大書畫細節</button></div>
          </div>
        </div>
        <dialog #referenceDialog class="scroll-inspection" aria-labelledby="scroll-inspection-title">
          <header><h2 id="scroll-inspection-title">{{ name() }}</h2><button type="button" (click)="referenceDialog.close()">返回盤面</button></header>
          <label>原圖放大倍率 <input type="range" min="1" max="3" step="0.25" [value]="zoom()" (input)="setZoom($event)" /> {{ zoom() }} 倍</label>
          <div class="scroll-reference-viewport" tabindex="0" role="region" aria-label="書畫原圖，放大後可捲動查看細節">
            <img [src]="image()" [alt]="name() + '完整原圖'" [style.width.%]="zoom() * 100" />
          </div>
        </dialog>
      }
    </div>
  `,
  styleUrl: './game-scroll-board.component.scss'
})
export class GameScrollBoardComponent {
  private readonly audio = inject(GameAudio);
  readonly slots = Array.from({ length: 15 }, (_, index) => index);
  readonly wrong = signal<number[]>([]);
  readonly hinted = signal(false);
  readonly initialSelection = input<number | null>(null);
  readonly initialHintRegion = input<number | null>(null);
  get selected(): number | null { return null; }
  get hintRegion(): number | null { return null; }
  /** 已接回的片數：從第一片起連續放對的格子數 */
  readonly filled = computed(() => { const order = this.order(); let count = 0; while (count < 15 && order[count] === count) count++; return count; });
  readonly tileRatio = computed(() => { const { ratio, columns, rows } = this.layout(); return ratio * rows / columns; });
  // 下一片的候選：一塊對的加兩塊還沒用到的，順序由種子決定，重新整理不會換
  readonly choices = computed(() => {
    const next = this.filled();
    if (next >= 15) return [] as number[];
    const rest = Array.from({ length: 14 - next }, (_, index) => next + 1 + index);
    let seed = 2166136261;
    for (const character of `${this.name()}|${next}`) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const shuffle = (items: number[]) => {
      for (let index = items.length - 1; index > 0; index--) {
        const other = Math.floor(random() * (index + 1));
        [items[index], items[other]] = [items[other], items[index]];
      }
      return items;
    };
    return shuffle([next, ...shuffle(rest).slice(0, 2)]);
  });
  pick(piece: number): void {
    if (this.disabled() || !this.ready() || this.solved()) return;
    this.moveMade.emit();
    const next = this.filled();
    if (piece !== next) { this.audio.play('error'); this.wrong.update(list => [...list, piece]); return; }
    this.audio.play('place');
    this.wrong.set([]); this.hinted.set(false);
    this.orderChange.emit(this.order().map((value, slot) => slot <= next ? slot : -1));
  }
  advanceDemonstration(): void { if (!this.solved()) this.pick(this.filled()); }
  /** 提示：把對的那一塊標出來 */
  requestHint(): void { if (this.disabled() || !this.ready() || this.solved() || this.hinted()) return; this.hinted.set(true); this.hintUsed.emit(); }
  /** 代完成：剩下的全部接回去，計入協助 */
  finishWithHelp(): void {
    if (this.disabled() || !this.ready()) return;
    const remaining = 15 - this.filled();
    if (!remaining) return;
    this.autoCompleted.emit(remaining);
    this.orderChange.emit(this.slots.slice());
    if (this.settleAfterHelp()) this.settlementRequested.emit();
  }
  @ViewChild('referenceDialog') private referenceDialog?: ElementRef<HTMLDialogElement>;
  openReference(): void { this.referenceDialog?.nativeElement.showModal(); }
  readonly image = input.required<string>();
  readonly name = input.required<string>();
  readonly order = input.required<readonly number[]>();
  readonly selection = input<number | null>(null);
  readonly disabled = input(false);
  readonly orderChange = output<number[]>();
  readonly moveMade = output<void>();
  readonly hintUsed = output<void>();
  readonly autoCompleted = output<number>();
  readonly assistedPieces = input(0);
  readonly availabilityChange = output<boolean>();
  readonly settleAfterHelp = input(false);
  readonly settlementRequested = output<void>();
  readonly failed = signal(false);
  readonly ready = signal(false);
  readonly imageRevision = signal(0);
  readonly zoom = signal(1);
  private readonly dimensions = signal({ width: 3, height: 1 });
  readonly layout = computed(() => scrollGeometry(this.dimensions().width, this.dimensions().height));
  readonly solved = computed(() => this.order().length === 15 && this.order().every((piece, slot) => piece === slot));

  constructor() {
    effect(() => {
      const image = this.image();
      this.failed.set(false);
      this.wrong.set([]);
      this.hinted.set(false);
      this.ready.set(false);
      this.dimensions.set({ width: 5, height: 3 });
      this.zoom.set(1);
      this.availabilityChange.emit(!!image);
    });
  }

  readDimensions(event: Event): void {
    const image = event.target as HTMLImageElement;
    this.dimensions.set({ width: image.naturalWidth, height: image.naturalHeight });
    this.ready.set(true);
    this.availabilityChange.emit(this.layout().eligible);
  }

  onImageError(): void {
    this.failed.set(true);
    this.ready.set(false);
    this.availabilityChange.emit(false);
  }

  retryImage(): void {
    this.failed.set(false);
    this.ready.set(false);
    this.imageRevision.update(value => value + 1);
  }

  rowOf(piece: number): number { return Math.floor(piece / this.layout().columns); }

  setZoom(event: Event): void { this.zoom.set(Number((event.target as HTMLInputElement).value)); }
}
