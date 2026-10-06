import { Component, ElementRef, ViewChild, computed, effect, inject, input, output, signal } from '@angular/core';
import { GameAudio } from './game-audio.service';

/** 保留給舊測試與其他頁面使用的版面計算；滑拼固定是 4×4。 */
export function scrollGeometry(width: number, height: number) {
  const ratio = width > 0 && height > 0 ? width / height : 5 / 3;
  const horizontal = ratio >= 1;
  return { horizontal, ratio, eligible: ratio >= .5 && ratio <= 2.2, columns: horizontal ? 5 : 3, rows: horizontal ? 3 : 5 };
}

export const SLIDE_SIZE = 4;
const CELLS = SLIDE_SIZE * SLIDE_SIZE;
const PIECES = CELLS - 1;

/** 十五格的紀錄還原成十六格盤面：-1 是空格；第十六格的碎片由「少掉的那一片」推回來。 */
export function decodeSlide(order: readonly number[]): number[] | null {
  if (order.length !== PIECES) return null;
  const blanks = order.filter(piece => piece === -1).length;
  const pieces = order.filter(piece => piece >= 0);
  if (blanks > 1 || new Set(pieces).size !== pieces.length || pieces.some(piece => piece >= PIECES)) return null;
  const cells = [...order, -1];
  if (blanks === 1) cells[PIECES] = Array.from({ length: PIECES }, (_, piece) => piece).find(piece => !pieces.includes(piece)) ?? -1;
  return cells;
}
export function encodeSlide(cells: readonly number[]): number[] { return cells.slice(0, PIECES); }

function blankOf(cells: readonly number[]): number { return cells.indexOf(-1); }

/** 簡單版（相鄰交換）：十五片是 0–14 的排列，右下角第十六片固定不動。 */
export function decodeSwap(order: readonly number[]): number[] | null {
  if (order.length !== PIECES || new Set(order).size !== PIECES || order.some(piece => piece < 0 || piece >= PIECES)) return null;
  return [...order, PIECES];
}
export function swapAdjacent(cells: readonly number[], a: number, b: number): number[] | null {
  if (a === b || a >= PIECES || b >= PIECES) return null;
  const near = (Math.floor(a / SLIDE_SIZE) === Math.floor(b / SLIDE_SIZE) && Math.abs(a - b) === 1) || Math.abs(a - b) === SLIDE_SIZE;
  if (!near) return null;
  const next = [...cells];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}
function seededRandom(seedText: string): () => number {
  let seed = 2166136261;
  for (const character of seedText) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0;
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
const distance = (a: number, b: number) => Math.abs(Math.floor(a / SLIDE_SIZE) - Math.floor(b / SLIDE_SIZE)) + Math.abs((a % SLIDE_SIZE) - (b % SLIDE_SIZE));

/** 每一局的最少步數都相同：從完成的盤面倒著走，每一步都讓被動到的碎片離家更遠一格，
 *  所以打亂後所有碎片離家的總距離剛好是步數的兩倍（簡單，一次交換動兩片）或一倍（困難，一次滑一片），
 *  這就是最少步數的下限，倒著走回來也正好達到，最少步數因此固定。 */
export const SWAP_SHUFFLE_MOVES = 12;
export const SLIDE_SHUFFLE_MOVES = 36;

/** 簡單版：同一個種子永遠洗出同一盤，最少要交換 SWAP_SHUFFLE_MOVES 次。 */
export function swapShuffle(seedText: string, moves = SWAP_SHUFFLE_MOVES): number[] {
  const random = seededRandom(seedText);
  const pairs: [number, number][] = [];
  for (let at = 0; at < PIECES; at++) {
    if (at % SLIDE_SIZE < SLIDE_SIZE - 1 && at + 1 < PIECES) pairs.push([at, at + 1]);
    if (at + SLIDE_SIZE < PIECES) pairs.push([at, at + SLIDE_SIZE]);
  }
  for (;;) {
    const cells = Array.from({ length: PIECES }, (_, index) => index);
    let done = 0;
    while (done < moves) {
      const options = pairs.filter(([a, b]) => distance(cells[a], b) > distance(cells[a], a) && distance(cells[b], a) > distance(cells[b], b));
      if (!options.length) break;
      const [a, b] = options[Math.floor(random() * options.length)];
      [cells[a], cells[b]] = [cells[b], cells[a]];
      done++;
    }
    if (done === moves) return cells;
  }
}

/** 點到的格子往空格方向滑；同一行或同一列的整排一起動。回傳新盤面與移動的片數。 */
export function slideCells(cells: readonly number[], index: number): { cells: number[]; moved: number } | null {
  const blank = blankOf(cells);
  const row = Math.floor(index / SLIDE_SIZE), column = index % SLIDE_SIZE;
  const blankRow = Math.floor(blank / SLIDE_SIZE), blankColumn = blank % SLIDE_SIZE;
  if (index === blank || (row !== blankRow && column !== blankColumn)) return null;
  const step = row === blankRow ? (blankColumn > column ? 1 : -1) : (blankRow > row ? SLIDE_SIZE : -SLIDE_SIZE);
  const next = [...cells];
  let moved = 0;
  for (let at = blank; at !== index; at -= step) { next[at] = next[at - step]; moved++; }
  next[index] = -1;
  return { cells: next, moved };
}

export function isSlideSolved(cells: readonly number[]): boolean {
  return cells[PIECES] === -1 && cells.slice(0, PIECES).every((piece, index) => piece === index);
}

/** 困難版：從已解開的盤面倒著滑 count 步，每一步都讓被滑動的碎片離家更遠一格，所以最少步數固定等於 count。 */
export function slideShuffle(seedText: string, count = SLIDE_SHUFFLE_MOVES): number[] {
  const random = seededRandom(seedText);
  for (;;) {
    let cells = Array.from({ length: CELLS }, (_, index) => index < PIECES ? index : -1);
    let previous = -1;
    let done = 0;
    while (done < count) {
      const blank = blankOf(cells);
      const row = Math.floor(blank / SLIDE_SIZE), column = blank % SLIDE_SIZE;
      const options = [row > 0 ? blank - SLIDE_SIZE : -1, row < SLIDE_SIZE - 1 ? blank + SLIDE_SIZE : -1, column > 0 ? blank - 1 : -1, column < SLIDE_SIZE - 1 ? blank + 1 : -1]
        .filter(index => index >= 0 && index !== previous && distance(cells[index], blank) > distance(cells[index], index));
      if (!options.length) break;
      const pick = options[Math.floor(random() * options.length)];
      previous = blank;
      cells = slideCells(cells, pick)!.cells;
      done++;
    }
    if (done === count && !isSlideSolved(cells)) return encodeSlide(cells);
  }
}

/** 試玩用：IDA* 找出把盤面滑回原樣的步驟（每步是要點的格子）；步數少時瞬間完成。 */
export function solveSlide(start: readonly number[], limit = 40): number[] | null {
  const heuristic = (cells: readonly number[]) => cells.reduce((sum, piece, index) => piece < 0 ? sum : sum + Math.abs(Math.floor(piece / SLIDE_SIZE) - Math.floor(index / SLIDE_SIZE)) + Math.abs(piece % SLIDE_SIZE - index % SLIDE_SIZE), 0);
  let nodes = 0;
  const path: number[] = [];
  const search = (cells: number[], cost: number, bound: number, previous: number): number => {
    const estimate = cost + heuristic(cells);
    if (estimate > bound) return estimate;
    if (isSlideSolved(cells)) return -1;
    if (++nodes > 400000) return Infinity;
    let min = Infinity;
    const blank = blankOf(cells);
    const row = Math.floor(blank / SLIDE_SIZE), column = blank % SLIDE_SIZE;
    for (const index of [row > 0 ? blank - SLIDE_SIZE : -1, row < SLIDE_SIZE - 1 ? blank + SLIDE_SIZE : -1, column > 0 ? blank - 1 : -1, column < SLIDE_SIZE - 1 ? blank + 1 : -1]) {
      if (index < 0 || index === previous) continue;
      path.push(index);
      const result = search(slideCells(cells, index)!.cells, cost + 1, bound, blank);
      if (result === -1) return -1;
      path.pop();
      if (result < min) min = result;
    }
    return min;
  };
  let bound = heuristic(start);
  while (bound <= limit) {
    path.length = 0;
    const result = search([...start], 0, bound, -1);
    if (result === -1) return [...path];
    if (!isFinite(result)) return null;
    bound = result;
  }
  return null;
}

@Component({
  selector: 'app-game-scroll-board',
  template: `
    <div class="scroll-workbench" [style.--scroll-ratio]="ratio()">
      @if (!image() || failed()) {
        <div class="scroll-error" role="alert"><p>書畫圖片暫時無法顯示，進度仍保留。</p><button type="button" (click)="retryImage()">重新載入圖片</button></div>
      } @else {
        @for (revision of [imageRevision()]; track revision) {
          <img class="scroll-source" [src]="image()" alt="" aria-hidden="true" (load)="readDimensions($event)" (error)="onImageError()" />
        }
        <div class="swap" [style.--cols]="size" [style.--tile-ratio]="ratio()">
            <button type="button" class="swap-ref" (click)="openReference()" aria-haspopup="dialog"><img [src]="image()" alt="" /><span>看原圖</span></button>
          <div class="swap-grid" [class.is-swap]="!hard()" role="group" tabindex="0" [attr.aria-label]="'書畫拼貼，已歸位 ' + correct() + ' ／ 15 片，點碎片滑進空格，方向鍵也能移動'" (keydown)="onKey($event)">
            @for (cell of cells(); track $index; let index = $index) {
              @let piece = cell < 0 ? 15 : cell;
              @if (cell < 0 && !solved()) { <span class="swap-blank" aria-hidden="true"></span> }
              @else {
                <button type="button" class="swap-tile" [class.is-movable]="hard() && movable(index)" [class.is-picked]="picked() === index" [class.is-fixed]="!hard() && index === 15" [class.is-correct]="!hard() && piece === index && index < 15" [class.is-hint]="hintSlots().includes(index)" [class.is-nudge]="nudge() === index"
                  [disabled]="disabled() || !ready() || solved() || (!hard() && index === 15)" [attr.aria-label]="'第 ' + (index + 1) + ' 格' + (!hard() && piece === index ? '，已歸位' : hard() && movable(index) ? '，可以滑動' : '') + (picked() === index ? '，已選取' : '')" (click)="tap(index)">
                  <img [src]="image()" alt="" draggable="false" [style.width.%]="size * 100" [style.height.%]="size * 100" [style.left.%]="-(piece % size) * 100" [style.top.%]="-rowOf(piece) * 100" />
                  @if (!hard() && index < 15) { <b aria-hidden="true">{{ piece + 1 }}</b> }
                </button>
              }
            }
          </div>
          <aside class="swap-side">
            @if (showSummary()) {
            <p class="swap-count"><strong>{{ correct() }}</strong><span>／ 15 片歸位</span></p>
            <p class="swap-moves">已{{ hard() ? '滑動' : '移動' }} <b>{{ moves() }}</b> 次</p>
            <p class="swap-rule">{{ solved() ? '畫面接回來了！' : hard() ? '點空格旁邊的碎片滑進去，同一行或同一列會一起滑。困難沒有編號與勾號。' : '先點一片碎片，再點它旁邊的碎片，兩片就會交換。右下角那片已固定好，碎片左下角是編號。' }}</p>
            }
          </aside>
        </div>
        <dialog #referenceDialog class="scroll-inspection" aria-labelledby="scroll-inspection-title">
          <header><h2 id="scroll-inspection-title">{{ name() }}</h2><button type="button" (click)="referenceDialog.close()">返回盤面</button></header>
          <label>原圖放大倍率 <input type="range" min="1" max="4" step="0.5" [value]="zoom()" (input)="setZoom($event)" /> {{ zoom() }} 倍</label>
          <div class="scroll-reference-viewport" tabindex="0" role="region" aria-label="書畫原圖，放大後可捲動查看細節">
            <img [src]="image()" [alt]="name() + '完整原圖'" [style.width.%]="zoom() * 100" [style.max-height]="zoom() === 1 ? 'calc(100dvh - 200px)' : null" />
          </div>
        </dialog>
      }
    </div>
  `,
  styleUrl: './game-scroll-board.component.scss'
})
export class GameScrollBoardComponent {
  readonly showSummary = input(true);
  private readonly audio = inject(GameAudio);
  readonly size = SLIDE_SIZE;
  readonly slots = Array.from({ length: PIECES }, (_, index) => index);
  /** 困難：沒有編號與歸位勾號。 */
  readonly hard = input(false);
  readonly moves = input(0);
  readonly hinted = signal(false);
  readonly wrong = signal<number[]>([]);
  readonly nudge = computed(() => this.wrong()[0] ?? null);
  readonly initialSelection = input<number | null>(null);
  readonly initialHintRegion = input<number | null>(null);
  get selected(): number | null { return null; }
  get hintRegion(): number | null { return null; }
  /** 盤面十六格；紀錄不合法（舊局、試玩或空白）時用書畫名稱洗一盤。 */
  readonly cells = computed(() => this.hard()
    ? decodeSlide(this.order()) ?? decodeSlide(slideShuffle(this.name()))!
    : decodeSwap(this.order()) ?? decodeSwap(swapShuffle(this.name()))!);
  /** 簡單版目前選起來、等著和旁邊交換的格子。 */
  readonly picked = signal<number | null>(null);
  readonly correct = computed(() => this.cells().filter((piece, index) => index < PIECES && piece === index).length);
  readonly solved = computed(() => this.hard() ? isSlideSolved(this.cells()) : this.correct() === PIECES);
  readonly ratio = computed(() => { const { width, height } = this.dimensions(); return width > 0 && height > 0 ? width / height : 1; });
  /** 提示：標出第一個放錯的格子，以及它該有的那一片現在在哪。 */
  readonly hintSlots = computed(() => {
    if (!this.hinted()) return [] as number[];
    const cells = this.cells();
    const wrong = cells.findIndex((piece, index) => index < PIECES && piece !== index);
    return wrong < 0 ? [] : [wrong, cells.indexOf(wrong)];
  });
  rowOf(piece: number): number { return Math.floor(piece / SLIDE_SIZE); }
  movable(index: number): boolean {
    const blank = blankOf(this.cells());
    return index !== blank && (Math.floor(index / SLIDE_SIZE) === Math.floor(blank / SLIDE_SIZE) || index % SLIDE_SIZE === blank % SLIDE_SIZE);
  }
  tap(index: number): void {
    if (this.disabled() || !this.ready() || this.solved()) return;
    if (!this.hard()) { this.tapSwap(index); return; }
    const result = slideCells(this.cells(), index);
    if (!result) { this.audio.play('error'); this.wrong.set([index]); setTimeout(() => this.wrong.set([]), 300); return; }
    for (let step = 0; step < result.moved; step++) this.moveMade.emit();
    this.hinted.set(false);
    this.audio.play(isSlideSolved(result.cells) ? 'success' : 'place');
    this.orderChange.emit(encodeSlide(result.cells));
  }
  /** 簡單版：點一片，再點旁邊的碎片就交換；點到不相鄰的就改選那一片。 */
  private tapSwap(index: number): void {
    const from = this.picked();
    if (index >= PIECES) { this.audio.play('error'); this.wrong.set([index]); setTimeout(() => this.wrong.set([]), 300); return; }
    if (from === null || from === index) { this.picked.set(from === index ? null : index); return; }
    const next = swapAdjacent(this.cells(), from, index);
    if (!next) { this.picked.set(index); return; }
    this.picked.set(null);
    this.hinted.set(false);
    this.moveMade.emit();
    this.audio.play(next.slice(0, PIECES).every((piece, at) => piece === at) ? 'success' : 'place');
    this.orderChange.emit(next.slice(0, PIECES));
  }
  onKey(event: KeyboardEvent): void {
    if (!this.hard()) return;
    const blank = blankOf(this.cells());
    const offsets: Record<string, number> = { ArrowLeft: 1, ArrowRight: -1, ArrowUp: SLIDE_SIZE, ArrowDown: -SLIDE_SIZE };
    const offset = offsets[event.key];
    if (offset === undefined) return;
    event.preventDefault();
    const target = blank + offset;
    const sameRow = Math.floor(target / SLIDE_SIZE) === Math.floor(blank / SLIDE_SIZE);
    if (target < 0 || target >= CELLS || (Math.abs(offset) === 1 && !sameRow)) return;
    this.tap(target);
  }
  advanceDemonstration(): void {
    if (this.solved()) return;
    if (!this.hard()) {
      const cells = this.cells();
      const at = cells.findIndex((piece, index) => index < PIECES && piece !== index);
      const next = [...cells]; const from = cells.indexOf(at);
      [next[at], next[from]] = [next[from], next[at]];
      this.moveMade.emit();
      this.orderChange.emit(next.slice(0, PIECES));
      return;
    }
    const path = solveSlide(this.cells());
    if (path?.length) this.tap(path[0]);
    else this.orderChange.emit(this.slots.slice());
  }
  requestHint(): void { if (this.disabled() || !this.ready() || this.solved() || this.hinted()) return; this.hinted.set(true); this.hintUsed.emit(); }
  /** 代完成：剩下的全部滑回去，計入協助 */
  finishWithHelp(): void {
    if (this.disabled() || !this.ready()) return;
    const remaining = PIECES - this.correct();
    if (!remaining) return;
    this.autoCompleted.emit(remaining);
    this.orderChange.emit(this.slots.slice());
    if (this.settleAfterHelp()) this.settlementRequested.emit();
  }
  @ViewChild('referenceDialog') private referenceDialog?: ElementRef<HTMLDialogElement>;
  openReference(): void {
    const dialog = this.referenceDialog?.nativeElement;
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>('.scroll-reference-viewport')?.focus();
  }
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
  readonly dimensions = signal({ width: 1, height: 1 });
  readonly layout = computed(() => scrollGeometry(this.dimensions().width, this.dimensions().height));

  constructor() {
    effect(() => {
      const image = this.image();
      this.failed.set(false);
      this.hinted.set(false);
      this.wrong.set([]);
      this.picked.set(null);
      this.ready.set(false);
      this.dimensions.set({ width: 1, height: 1 });
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

  setZoom(event: Event): void { this.zoom.set(Number((event.target as HTMLInputElement).value)); }
}
