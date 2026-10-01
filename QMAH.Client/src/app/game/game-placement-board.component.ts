import { Component, ElementRef, HostListener, computed, effect, input, output, signal } from '@angular/core';

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
    <div class="placement-tools">
      <button type="button" (click)="referenceDialog.showModal()" aria-haspopup="dialog">原圖與格線</button>
      <button type="button" (click)="showRegion()" [disabled]="!ready() || disabled() || selected() === null || solved()">區域提示（−3 分）</button>
      <button type="button" (click)="confirmDialog.showModal()" [disabled]="!ready() || disabled() || solved()">完成剩餘碎片</button>
      <button type="button" (click)="pieceDialog.showModal()" [disabled]="selected() === null">放大選取碎片</button>
      <ng-content />
    </div>
    <dialog #referenceDialog class="assist-dialog reference-dialog" aria-label="原圖與格線"><button type="button" (click)="referenceDialog.close()">返回盤面</button><figure class="reference"><img [src]="image()" [alt]="name() + '原圖'" /><div [style.grid-template-columns]="columnsStyle()" [style.grid-template-rows]="rowsStyle()">@for (cell of order(); track $index) { <span>{{ $index + 1 }}</span> }</div></figure></dialog>
    <div class="placement-workspace" [style.--piece-ratio]="displayRatio()" [style.--image-width.px]="naturalWidth()">
      <div class="placement-board" [class.is-solved]="solved()" [style.aspect-ratio]="displayRatio()" [style.grid-template-columns]="columnsStyle()" [style.grid-template-rows]="rowsStyle()" role="group" aria-label="拼圖目標盤面">
        @for (piece of order(); track $index; let slot = $index) {
          <button type="button" class="piece slot" [attr.data-slot]="slot" [class.selected]="piece >= 0 && selected() === piece" [class.is-lifted]="piece >= 0 && lifted() === piece" [class.just-placed]="lastPlaced() === slot" [class.hinted]="hintRegion() !== null && region(slot) === hintRegion()" [disabled]="!ready() || disabled() || solved()" [attr.aria-label]="'第 ' + (slot + 1) + ' 格' + (piece < 0 ? '，空格' : '，已有碎片')" (click)="activateSlot(slot, $event)" (keydown)="moveFocus($event, slot)" (pointerdown)="beginDrag($event, piece)">
            @if (piece >= 0) { <img [src]="image()" alt="" draggable="false" [style.width.%]="columns() * 100" [style.height.%]="rows() * 100" [style.left.%]="-(piece % columns()) * 100" [style.top.%]="-row(piece) * 100" /> }
            <span>{{ slot + 1 }}</span>
          </button>
        }
      </div>
      <section class="piece-supply" aria-label="待放置碎片">
        <h4>待放置 {{ tray().length }} 片</h4>
        <div class="piece-tray" [style.aspect-ratio]="displayRatio()" [style.grid-template-columns]="columnsStyle()" [style.grid-template-rows]="rowsStyle()" [style.column-gap.%]="4 / (columns() - 1)" [style.row-gap.%]="4 / (rows() - 1)">
          @for (piece of traySlots(); track piece) {
            @if (!order().includes(piece)) {
            <button type="button" class="piece" [attr.data-piece]="piece" [class.selected]="selected() === piece" [class.is-lifted]="lifted() === piece" [disabled]="!ready() || disabled()" [attr.aria-label]="'選取待放置碎片 ' + (tray().indexOf(piece) + 1)" [attr.aria-pressed]="selected() === piece" (click)="select(piece, $event)" (keydown)="moveFocus($event, tray().indexOf(piece))" (pointerdown)="beginDrag($event, piece)">
              <img [src]="image()" alt="" draggable="false" [style.width.%]="columns() * 100" [style.height.%]="rows() * 100" [style.left.%]="-(piece % columns()) * 100" [style.top.%]="-row(piece) * 100" />
            </button>
            } @else { <span class="placed-slot" aria-hidden="true"></span> }
          }
        </div>
        <p>拖到目標格；也可點選碎片，再點目的格。放錯時可重放，原有碎片會回到備選區。</p>
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
      <p>還有 {{ remaining() }} 格未歸位。代完成扣 {{ assistancePenalty() }} 分，且本局不會獲得 S 級。{{ settleAfterHelp() ? '確認後會完成盤面並送出結果，獎勵依最後評分發放。' : '完成後仍需自行送出結果。' }}</p>
      <button type="button" (click)="confirmDialog.close()">繼續自己拼</button>
      <button type="button" (click)="autoFinish(); confirmDialog.close()">確認代完成</button>
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
  readonly availabilityChange = output<boolean>();
  readonly settleAfterHelp = input(false);
  readonly settlementRequested = output<void>();
  readonly failed = signal(false);
  readonly imageRevision = signal(0);
  readonly selected = signal<number | null>(null);
  readonly hintRegion = signal<number | null>(null);
  readonly feedback = signal('先觀察輪廓、紋飾與明暗，再把碎片拖到目標格。');
  readonly dragging = signal<{ piece: number; x: number; y: number; width: number } | null>(null);
  readonly lifted = signal<number | null>(null);
  readonly lastPlaced = signal<number | null>(null);
  readonly solved = computed(() => this.order().every((piece, slot) => piece === slot));
  readonly remaining = computed(() => this.order().filter((piece, slot) => piece !== slot).length);
  readonly assistancePenalty = computed(() => Math.ceil(60 * this.remaining() / this.order().length));
  readonly columnsStyle = computed(() => 'repeat(' + this.columns() + ', minmax(0, 1fr))');
  readonly rowsStyle = computed(() => 'repeat(' + this.rows() + ', minmax(0, 1fr))');
  readonly traySlots = computed(() => Array.from({ length: this.order().length }, (_, piece) => piece).sort((a, b) => this.shuffleKey(a) - this.shuffleKey(b)));
  readonly tray = computed(() => Array.from({ length: this.order().length }, (_, piece) => piece)
    .filter(piece => !this.order().includes(piece)).sort((a, b) => this.shuffleKey(a) - this.shuffleKey(b)));
  private readonly host: ElementRef<HTMLElement>;
  private pointer: { id: number; piece: number; x: number; y: number; width: number } | null = null;
  private suppressClick = false;
  constructor(host: ElementRef<HTMLElement>) {
    this.host = host;
    effect(() => { this.selected.set(this.initialSelection()); this.hintRegion.set(this.initialHintRegion()); });
  }
  readImage(event: Event): void {
    const image = event.target as HTMLImageElement;
    this.naturalRatio.set(image.naturalWidth / Math.max(1, image.naturalHeight));
    this.naturalWidth.set(image.naturalWidth);
    this.failed.set(false);
    this.ready.set(true);
    this.availabilityChange.emit(true);
  }
  imageError(): void { this.ready.set(false); this.failed.set(true); this.availabilityChange.emit(false); }
  retryImage(): void { this.ready.set(false); this.failed.set(false); this.imageRevision.update(value => value + 1); }
  row(piece: number): number { return Math.floor(piece / this.columns()); }
  private shuffleKey(piece: number): number { return Math.sin((piece + 1) * 127.1) * 43758.5453 % 1; }
  region(slot: number): number { return (this.row(slot) >= this.rows() / 2 ? 2 : 0) + (slot % this.columns() >= this.columns() / 2 ? 1 : 0); }
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
    this.feedback.set('這塊屬於原圖的' + ['左上', '右上', '左下', '右下'][this.region(piece)] + '區域；已扣 3 分。');
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
    const columns = this.columns();
    const delta: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };
    if (!(event.key in delta) && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const buttons = Array.from((event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLButtonElement>('button') ?? []);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : slot + delta[event.key];
    buttons[Math.max(0, Math.min(buttons.length - 1, next))]?.focus();
  }
}
