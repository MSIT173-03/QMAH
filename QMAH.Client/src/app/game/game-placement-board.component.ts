import { Component, DestroyRef, ElementRef, HostListener, afterNextRender, computed, effect, inject, input, output, signal } from '@angular/core';
import { findBackgroundPieces } from './game-background-pieces';
import { scatterPieces } from './game-piece-scatter';

/** Empty slots are -1. Pieces have stable identities; a drop never swaps two pieces. */
export function placePiece(order: readonly number[], piece: number, slot: number): number[] {
  if (!Number.isInteger(piece) || piece < 0 || piece >= order.length || !Number.isInteger(slot) || slot < 0 || slot >= order.length) return [...order];
  const next = order.map(value => value === piece ? -1 : value);
  next[slot] = piece;
  return next;
}

@Component({
  selector: 'app-game-placement-board',
  template: `
    @for (revision of [imageRevision()]; track revision) { <img class="image-source" [src]="image()" alt="" aria-hidden="true" (load)="readImage($event)" (error)="imageError()" /> }
    @if (failed()) { <p role="alert">圖片暫時無法載入，盤面進度仍保留。<button type="button" (click)="retryImage()">重試圖片</button></p> }
    <dialog #referenceDialog class="assist-dialog reference-dialog" aria-label="原圖與格線"><button type="button" (click)="referenceDialog.close()">返回盤面</button><figure class="reference"><img [src]="image()" [alt]="name() + '原圖'" /><div [style.grid-template-columns]="columnsStyle()" [style.grid-template-rows]="rowsStyle()">@for (cell of order(); track $index) { <span>{{ $index + 1 }}</span> }</div></figure></dialog>
    <div class="placement-workspace" [style.--piece-ratio]="displayRatio()" [style.--tile-ratio]="pieceRatio()" [style.--image-width.px]="naturalWidth()">
      <div class="placement-board" [class.is-solved]="solved()" [style.aspect-ratio]="displayRatio()" [style.grid-template-columns]="columnsStyle()" [style.grid-template-rows]="rowsStyle()" role="group" aria-label="拼圖目標盤面">
        @for (piece of order(); track $index; let slot = $index) {
          <button type="button" class="piece slot" [attr.data-slot]="slot" [class.selected]="piece >= 0 && selected() === piece" [class.is-lifted]="piece >= 0 && lifted() === piece" [class.just-placed]="lastPlaced() === slot" [class.hinted]="hintRegion() !== null && region(slot) === hintRegion()" [disabled]="!ready() || disabled() || solved()" [attr.aria-label]="'第 ' + (slot + 1) + ' 格' + (piece < 0 ? '，空格' : '，已有碎片')" (click)="activateSlot(slot, $event)" (keydown)="moveFocus($event, slot)" (pointerdown)="beginDrag($event, piece)">
            @if (piece >= 0) { <img [src]="image()" alt="" draggable="false" [style.width.%]="columns() * 100" [style.height.%]="rows() * 100" [style.left.%]="-(piece % columns()) * 100" [style.top.%]="-row(piece) * 100" /> }
            <span>{{ slot + 1 }}</span>
          </button>
        }
      </div>
      <section class="piece-supply" aria-label="待放置碎片" [style.--piece-rows]="rows()">
        <div class="piece-supply-header"><h4>待放置 {{ tray().length }} 片</h4>
          <details class="placement-tools-menu"><summary>盤面工具</summary><div class="placement-tools">
            <button type="button" (click)="referenceDialog.showModal()" aria-haspopup="dialog">原圖與格線</button>
            <button type="button" (click)="showRegion()" [disabled]="!ready() || disabled() || selected() === null || solved()">區域提示（−3 分）</button>
            <button type="button" (click)="confirmDialog.showModal()" [disabled]="!ready() || disabled() || solved()">完成剩餘碎片</button>
            <button type="button" (click)="pieceDialog.showModal()" [disabled]="selected() === null">放大選取碎片</button>
            <button type="button" (click)="prepareBackground(); backgroundDialog.showModal()" [disabled]="!ready() || disabled() || solved()">預覽背景候選（不扣分）</button>
            <ng-content />
          </div></details>
        </div>@if (compactTools() && tray().length > columns()) { <p class="tray-scroll-note">上下捲動查看碎片，再拖曳或點選放置。</p> }
        <div class="piece-tray-viewport" tabindex="0" aria-label="待放置碎片，可捲動查看">
        <div class="piece-tray" [class.is-compact]="compactTools()" [style.grid-template-columns]="compactTools() ? null : 'repeat(' + scattered().columns + ', 1fr)'">
          @for (piece of compactTools() ? tray() : traySlots(); track piece) {
            @if (!order().includes(piece)) {
            <button type="button" class="piece" [style.left.%]="compactTools() ? null : scattered().pieces[$index].x" [style.top.%]="compactTools() ? null : scattered().pieces[$index].y" [style.width.%]="compactTools() ? null : scattered().pieces[$index].width" [style.height.%]="compactTools() ? null : scattered().pieces[$index].height" [style.--piece-turn]="scattered().pieces[$index].turn + 'deg'" [attr.data-piece]="piece" [class.selected]="selected() === piece" [class.is-lifted]="lifted() === piece" [disabled]="!ready() || disabled()" [attr.aria-label]="'選取待放置碎片 ' + (tray().indexOf(piece) + 1)" [attr.aria-pressed]="selected() === piece" (click)="select(piece, $event)" (keydown)="moveFocus($event, tray().indexOf(piece))" (pointerdown)="beginDrag($event, piece)">
              <img [src]="image()" alt="" draggable="false" [style.width.%]="columns() * 100" [style.height.%]="rows() * 100" [style.left.%]="-(piece % columns()) * 100" [style.top.%]="-row(piece) * 100" />
            </button>
            } @else { <span class="placed-slot" aria-hidden="true"></span> }
          }
        </div>
        </div>
        <details class="placement-instructions"><summary>操作說明</summary><div class="instructions-content"><p>把碎片拖到目標格，也可先點碎片，再點目的格。</p><p>放錯時可重新放置，被替換的碎片會回到待放置區。</p></div></details>
      </section>
    </div>
    <p class="placement-feedback" role="status">{{ feedback() }}</p>
    @if (dragging(); as drag) { <div class="piece drag-preview" aria-hidden="true" [style.width.px]="drag.width" [style.left.px]="drag.x" [style.top.px]="drag.y" [style.aspect-ratio]="displayRatio() * rows() / columns()"><img [src]="image()" alt="" [style.width.%]="columns() * 100" [style.height.%]="rows() * 100" [style.left.%]="-(drag.piece % columns()) * 100" [style.top.%]="-row(drag.piece) * 100" /></div> }
    <dialog #pieceDialog class="assist-dialog" aria-label="選取碎片細節">
      <button type="button" (click)="pieceDialog.close()">返回盤面</button>
      @if (selected(); as piece) { <div class="piece inspection-piece" [style.aspect-ratio]="pieceRatio()"><img [src]="image()" alt="選取碎片放大細節" [style.width.%]="columns() * 100" [style.height.%]="rows() * 100" [style.left.%]="-(piece % columns()) * 100" [style.top.%]="-row(piece) * 100" /></div> }
      @else if (selected() === 0) { <div class="piece inspection-piece" [style.aspect-ratio]="pieceRatio()"><img [src]="image()" alt="選取碎片放大細節" [style.width.%]="columns() * 100" [style.height.%]="rows() * 100" style="left:0;top:0" /></div> }
    </dialog>
    <dialog #confirmDialog class="assist-dialog" aria-labelledby="assist-title">
      <h3 id="assist-title">完成剩餘碎片？</h3>
      <p>還有 <span class="text-unit">{{ remaining() }} 格</span>未歸位。</p>
      <p>代完成扣 <span class="text-unit">{{ assistancePenalty() }} 分</span>，本局無法取得 <span class="text-unit">S 級</span>。</p>
      <p>{{ settleAfterHelp() ? '確認後會將剩餘碎片歸位，立即送出結果。' : '確認後會將剩餘碎片歸位。' }}</p>
      <p>{{ settleAfterHelp() ? '結算時依評分等級自動發放獎勵。' : '完成後請自行按「送出結果」。' }}</p>
      <button type="button" (click)="confirmDialog.close()">繼續自己拼</button>
      <button type="button" (click)="autoFinish(); confirmDialog.close()">確認代完成</button>
    </dialog>
    <dialog #backgroundDialog class="assist-dialog background-dialog" aria-labelledby="background-title">
      <h3 id="background-title">要協助歸位背景片嗎？</h3>
      <p>下列碎片顏色接近外框背景，細節也較少。</p>
      <p>偵測可能把有淡墨或圖案細節的碎片誤認為背景。</p>
      <p>請逐片查看，取消勾選有圖案或想自己拼的碎片。</p>
      @if (backgroundUnavailable()) {
        <p role="status">目前無法分析這張圖片。你仍可繼續拼圖，或使用原圖與格線對照。</p>
      } @else if (!pendingBackground().length) {
        <p role="status">沒有找到符合條件、尚未歸位的背景片。</p>
        <p>畫面有墨跡或圖案時，可能不會列出候選。你仍可使用原圖與格線對照。</p>
      } @else {
        <p>找到 <span class="text-unit">{{ pendingBackground().length }} 片</span>背景候選。</p>
        <p>相似的空白片可能看起來一樣。按下「歸位勾選的背景片」後，系統才會將它們放到正確格子。</p>
        <div class="background-candidates">
          @for (piece of pendingBackground(); track piece) {
            <label>
              <div class="piece" [style.aspect-ratio]="pieceRatio()"><img [src]="image()" alt="" [style.width.%]="columns() * 100" [style.height.%]="rows() * 100" [style.left.%]="-(piece % columns()) * 100" [style.top.%]="-row(piece) * 100" /></div>
              <span><input type="checkbox" [checked]="backgroundSelection().includes(piece)" (change)="setBackgroundSelected(piece, $event)" />候選 {{ $index + 1 }}</span>
            </label>
          }
        </div>
        <p>歸位已勾選的 <span class="text-unit">{{ selectedBackground().length }} 片</span>，本局成績再扣 <span class="text-unit">{{ backgroundPenalty() }} 分</span>。</p>
        <p>使用這項協助後，本局無法取得 <span class="text-unit">S 級</span>。</p>
        <p>歸位後可繼續拼其他碎片，最後自行按「送出結果」。</p>
        <p>若背景片的正確格子已放了其他碎片，原本的碎片會移回待放置區。</p>
      }
      <button type="button" (click)="backgroundDialog.close()">繼續自己拼</button>
      <button type="button" (click)="placeBackground(); backgroundDialog.close()" [disabled]="!selectedBackground().length || disabled() || !ready() || solved()">歸位勾選的背景片</button>
    </dialog>
  `,
  styleUrl: './game-placement-board.component.scss'
})
export class GamePlacementBoardComponent {
  readonly Math = Math;
  readonly image = input.required<string>();
  readonly name = input.required<string>();
  readonly order = input.required<readonly number[]>();
  readonly columns = input(5);
  readonly rows = input(5);
  readonly ratio = input<number | null>(null);
  readonly naturalRatio = signal(1);
  readonly naturalWidth = signal(560);
  readonly ready = signal(false);
  readonly initialSelection = input<number | null>(null);
  readonly initialHintRegion = input<number | null>(null);
  readonly displayRatio = computed(() => this.ratio() ?? this.naturalRatio());
  readonly pieceRatio = computed(() => this.displayRatio() * this.rows() / this.columns());
  readonly disabled = input(false);
  readonly orderChange = output<number[]>();
  readonly moveMade = output<void>();
  readonly hintUsed = output<void>();
  readonly autoCompleted = output<number>();
  readonly assistedPieces = input(0);
  readonly backgroundPieces = signal<number[]>([]);
  readonly backgroundSelection = signal<number[]>([]);
  readonly backgroundUnavailable = signal(false);
  readonly pendingBackground = computed(() => this.backgroundPieces().filter(piece => this.order()[piece] !== piece));
  readonly selectedBackground = computed(() => this.pendingBackground().filter(piece => this.backgroundSelection().includes(piece)));
  readonly backgroundPenalty = computed(() => Math.ceil(60 * (this.assistedPieces() + this.selectedBackground().length) / this.order().length)
    - Math.ceil(60 * this.assistedPieces() / this.order().length));
  readonly availabilityChange = output<boolean>();
  readonly settleAfterHelp = input(false);
  readonly settlementRequested = output<void>();
  readonly failed = signal(false);
  readonly imageRevision = signal(0);
  readonly compactTools = signal(false);
  readonly selected = signal<number | null>(null);
  readonly hintRegion = signal<number | null>(null);
  readonly feedback = signal('先觀察輪廓、紋飾與明暗，再把碎片拖到目標格。');
  readonly dragging = signal<{ piece: number; x: number; y: number; width: number } | null>(null);
  readonly lifted = signal<number | null>(null);
  readonly lastPlaced = signal<number | null>(null);
  readonly solved = computed(() => this.order().every((piece, slot) => piece === slot));
  readonly remaining = computed(() => this.order().filter((piece, slot) => piece !== slot).length);
  readonly assistancePenalty = computed(() => Math.ceil(60 * (this.assistedPieces() + this.remaining()) / this.order().length)
    - Math.ceil(60 * this.assistedPieces() / this.order().length));
  readonly columnsStyle = computed(() => 'repeat(' + this.columns() + ', minmax(0, 1fr))');
  readonly rowsStyle = computed(() => 'repeat(' + this.rows() + ', minmax(0, 1fr))');
  readonly traySlots = computed(() => Array.from({ length: this.order().length }, (_, piece) => piece).sort((a, b) => this.shuffleKey(a) - this.shuffleKey(b)));
  readonly traySize = signal({ width: 360, height: 300 });
  readonly scattered = computed(() => scatterPieces(this.order().length, this.traySize().width, this.traySize().height, this.pieceRatio()));
  readonly tray = computed(() => Array.from({ length: this.order().length }, (_, piece) => piece)
    .filter(piece => !this.order().includes(piece)).sort((a, b) => this.shuffleKey(a) - this.shuffleKey(b)));
  private readonly host: ElementRef<HTMLElement>;
  private pointer: { id: number; piece: number; x: number; y: number; width: number } | null = null;
  private suppressClick = false;
  constructor(host: ElementRef<HTMLElement>) {
    this.host = host;
    effect(() => { this.selected.set(this.initialSelection()); this.hintRegion.set(this.initialHintRegion()); });
    this.updateCompactTools();
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const tray = this.host.nativeElement.querySelector<HTMLElement>('.piece-tray');
      if (!tray) return;
      const observer = new ResizeObserver(() => this.traySize.set({ width:tray.clientWidth, height:tray.clientHeight }));
      observer.observe(tray);
      destroy.onDestroy(() => observer.disconnect());
    });
  }
  @HostListener('window:resize')
  updateCompactTools(): void {
    if (typeof window === 'undefined') return;
    this.compactTools.set(window.matchMedia?.('(max-width: 700px)').matches ?? window.innerWidth <= 700);
  }
  readImage(event: Event): void {
    const image = event.target as HTMLImageElement;
    this.naturalRatio.set(image.naturalWidth / Math.max(1, image.naturalHeight));
    this.naturalWidth.set(image.naturalWidth);
    this.failed.set(false);
    this.ready.set(true);
    this.analyzeBackground(image);
    this.availabilityChange.emit(true);
  }
  private analyzeBackground(image: HTMLImageElement): void {
    this.backgroundPieces.set([]);
    this.backgroundSelection.set([]);
    this.backgroundUnavailable.set(false);
    try {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.floor(image.naturalWidth * scale);
      canvas.height = Math.floor(image.naturalHeight * scale);
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('無法讀取圖片');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      this.backgroundPieces.set(findBackgroundPieces(context.getImageData(0, 0, canvas.width, canvas.height).data,
        canvas.width, canvas.height, this.columns(), this.rows()));
    } catch {
      // 跨來源圖片或瀏覽器無法讀取像素時保留原盤面，不以分析失敗阻擋遊戲。
      this.backgroundUnavailable.set(true);
    }
  }
  prepareBackground(): void { this.backgroundSelection.set([...this.pendingBackground()]); }
  setBackgroundSelected(piece: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.backgroundSelection.update(selection => checked
      ? [...new Set([...selection, piece])] : selection.filter(value => value !== piece));
  }
  placeBackground(): void {
    const pieces = this.selectedBackground();
    if (!pieces.length || this.disabled() || !this.ready() || this.solved()) return;
    const next = pieces.reduce((order, piece) => placePiece(order, piece, piece), [...this.order()]);
    this.autoCompleted.emit(pieces.length);
    this.orderChange.emit(next);
    this.selected.set(null);
    this.hintRegion.set(null);
    this.backgroundSelection.set([]);
    this.feedback.set(`已協助歸位 ${pieces.length} 片背景候選，並記錄輔助扣分。你可以繼續拼其他碎片。`);
  }
  imageError(): void { this.ready.set(false); this.failed.set(true); this.availabilityChange.emit(false); }
  retryImage(): void { this.ready.set(false); this.failed.set(false); this.imageRevision.update(value => value + 1); }
  row(piece: number): number { return Math.floor(piece / this.columns()); }
  private shuffleKey(piece: number): number { return Math.sin((piece + 1) * 127.1) * 43758.5453 % 1; }
  region(slot: number): number { return (this.row(slot) >= this.rows() / 2 ? 2 : 0) + (slot % this.columns() >= this.columns() / 2 ? 1 : 0); }
  advanceDemonstration(): void {
    if (!this.ready() || this.disabled() || this.solved()) return;
    const next = this.order().findIndex((piece, slot) => piece !== slot);
    if (this.selected() === next) this.activateSlot(next);
    else this.select(next);
  }
  select(piece: number, event?: MouseEvent): void {
    if (this.suppressClick && event?.detail !== 0) { this.suppressClick = false; return; }
    this.suppressClick = false;
    this.selected.set(this.selected() === piece ? null : piece); this.hintRegion.set(null);
  }
  activateSlot(slot: number, event?: MouseEvent): void {
    if (this.suppressClick && event?.detail !== 0) { this.suppressClick = false; return; }
    this.suppressClick = false;
    const piece = this.selected();
    if (piece === null) { if (this.order()[slot] >= 0) this.select(this.order()[slot]); return; }
    this.drop(piece, slot);
  }
  private drop(piece: number, slot: number): void {
    if (this.disabled() || this.solved() || this.order()[slot] === piece) return;
    this.orderChange.emit(placePiece(this.order(), piece, slot)); this.moveMade.emit();
    this.selected.set(null); this.hintRegion.set(null);
    this.lastPlaced.set(slot);
    this.feedback.set('已放置。可依完成比例確認整體進度，或查看原圖對照。');
  }
  showRegion(): void {
    const piece = this.selected();
    if (piece === null || this.disabled() || !this.ready() || this.hintRegion() !== null) return;
    this.hintRegion.set(this.region(piece)); this.hintUsed.emit();
    this.feedback.set('這塊屬於原圖的' + ['左上', '右上', '左下', '右下'][this.region(piece)] + '區域。已扣 3 分。');
  }
  requestHint(): void {
    if (this.disabled() || !this.ready() || this.solved()) return;
    if (this.selected() === null) {
      this.selected.set(this.order().findIndex((piece, slot) => piece !== slot));
      this.hintRegion.set(null);
    }
    this.showRegion();
  }
  autoFinish(): void {
    if (this.disabled() || !this.ready() || this.solved()) return;
    const count = this.remaining();
    this.autoCompleted.emit(count);
    this.orderChange.emit(this.order().map((_, slot) => slot));
    this.selected.set(null); this.hintRegion.set(null); this.feedback.set('代完成已記錄，現在可以送出結果。');
    if (this.settleAfterHelp()) this.settlementRequested.emit();
  }
  beginDrag(event: PointerEvent, piece: number): void {
    if (piece < 0 || this.disabled() || this.solved() || event.button !== 0) return;
    this.suppressClick = false;
    const source = event.currentTarget as HTMLElement;
    const width = (source.querySelector('.piece-face') ?? source).getBoundingClientRect().width;
    this.pointer = { id: event.pointerId, piece, x: event.clientX, y: event.clientY, width: width * 1.12 };
    this.lifted.set(piece); this.lastPlaced.set(null);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  @HostListener('document:pointermove', ['$event'])
  moveDrag(event: PointerEvent): void {
    if (!this.pointer || event.pointerId !== this.pointer.id) return;
    if (Math.hypot(event.clientX - this.pointer.x, event.clientY - this.pointer.y) < 6 && !this.dragging()) return;
    const bounds = (this.host.nativeElement.querySelector('.placement-workspace') ?? this.host.nativeElement).getBoundingClientRect();
    const halfWidth = this.pointer.width / 2;
    const halfHeight = halfWidth / this.pieceRatio();
    this.dragging.set({ piece: this.pointer.piece, width: this.pointer.width,
      x: Math.max(bounds.left + halfWidth, Math.min(bounds.right - halfWidth, event.clientX)),
      y: Math.max(bounds.top + halfHeight, Math.min(bounds.bottom - halfHeight, event.clientY)) });
    event.preventDefault();
  }
  @HostListener('document:pointerup', ['$event'])
  endDrag(event: PointerEvent): void {
    if (!this.pointer || event.pointerId !== this.pointer.id) return;
    if (this.dragging()) {
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-slot]');
      if (target && this.host.nativeElement.contains(target)) this.drop(this.pointer.piece, Number(target.dataset['slot']));
      this.suppressClick = true;
    }
    this.dragging.set(null); this.lifted.set(null); this.pointer = null;
  }
  @HostListener('document:pointercancel')
  @HostListener('document:lostpointercapture')
  @HostListener('window:blur')
  cancelDrag(): void { this.dragging.set(null); this.lifted.set(null); this.pointer = null; }
  moveFocus(event: KeyboardEvent, slot: number): void {
    const current = event.currentTarget as HTMLElement;
    const parent = current.parentElement;
    // 手機碎片匣會依寬度重排，方向鍵須跟著實際欄數移動。
    const columns = parent?.classList.contains('is-compact')
      ? getComputedStyle(parent).gridTemplateColumns.split(' ').length
      : parent?.classList.contains('piece-tray') ? this.scattered().columns : this.columns();
    const delta: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };
    if (!(event.key in delta) && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const cells = Array.from(current.parentElement?.children ?? []);
    const index = cells.indexOf(current);
    if (index < 0) return;
    // 依畫面上的格位移動，桌面版略過已歸位的空位。
    const step = event.key === 'End' ? -1 : event.key === 'Home' ? 1 : delta[event.key];
    let next = event.key === 'Home' ? 0 : event.key === 'End' ? cells.length - 1 : index + step;
    while (next >= 0 && next < cells.length) {
      if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight')
        && Math.floor(next / columns) !== Math.floor(index / columns)) return;
      const target = cells[next];
      if (target instanceof HTMLButtonElement && !target.disabled) { target.focus(); return; }
      next += step;
    }
  }
}
