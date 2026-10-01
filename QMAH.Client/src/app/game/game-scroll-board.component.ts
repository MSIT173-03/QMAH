import { Component, ElementRef, ViewChild, computed, effect, input, output, signal } from '@angular/core';
import { GamePlacementBoardComponent } from './game-placement-board.component';

export function scrollGeometry(width: number, height: number) {
  const ratio = width > 0 && height > 0 ? width / height : 5 / 3;
  const horizontal = ratio >= 1;
  return { horizontal, ratio, eligible: ratio >= .5 && ratio <= 2.2, columns: horizontal ? 5 : 3, rows: horizontal ? 3 : 5 };
}

@Component({
  selector: 'app-game-scroll-board',
  imports: [GamePlacementBoardComponent],
  template: `
    <div class="scroll-workbench" [style.--scroll-ratio]="layout().ratio">
      @if (ready() && !layout().eligible) {
        <p role="alert">這幅書畫比例不適合十五格復位，請返回選單重新選題；不會裁切或拉伸原圖。</p>
      } @else if (!image() || failed()) {
        <div class="scroll-error" role="alert"><p>書畫圖片暫時無法顯示，復位進度仍保留。</p><button type="button" (click)="retryImage()">重新載入圖片</button></div>
      } @else {
        @for (revision of [imageRevision()]; track revision) {
          <img class="scroll-source" [src]="image()" alt="" aria-hidden="true" (load)="readDimensions($event)" (error)="onImageError()" />
        }
        <app-game-placement-board [image]="image()" [name]="name()" [order]="order()" [initialSelection]="initialSelection()" [initialHintRegion]="initialHintRegion()" [columns]="layout().columns" [rows]="layout().rows" [ratio]="layout().ratio" [disabled]="disabled() || !ready()" (orderChange)="orderChange.emit($event)" (moveMade)="moveMade.emit()" (hintUsed)="hintUsed.emit()" (autoCompleted)="autoCompleted.emit($event)" [settleAfterHelp]="settleAfterHelp()" (settlementRequested)="settlementRequested.emit()"><div class="scroll-reference"><button type="button" (click)="openReference()" aria-haspopup="dialog">放大書畫細節</button></div></app-game-placement-board>
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
  @ViewChild(GamePlacementBoardComponent) private placement?: GamePlacementBoardComponent;
  readonly initialSelection = input<number | null>(null);
  readonly initialHintRegion = input<number | null>(null);
  get selected(): number | null { return this.placement?.selected() ?? null; }
  get hintRegion(): number | null { return this.placement?.hintRegion() ?? null; }
  requestHint(): void { this.placement?.requestHint(); }
  finishWithHelp(): void { this.placement?.autoFinish(); }
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

  moveFocus(event: KeyboardEvent, slot: number): void {
    const columns = this.layout().columns;
    const delta = { ArrowLeft: slot % columns > 0 ? -1 : 0, ArrowRight: slot % columns < columns - 1 ? 1 : 0, ArrowUp: -columns, ArrowDown: columns };
    let next = slot;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = 14;
    else if (event.key in delta) next += delta[event.key as keyof typeof delta] ?? 0;
    else return;
    event.preventDefault();
    const buttons = (event.currentTarget as HTMLElement).parentElement?.querySelectorAll('button');
    buttons?.[Math.max(0, Math.min(14, next))]?.focus();
  }

  rowOf(piece: number): number { return Math.floor(piece / this.layout().columns); }

  setZoom(event: Event): void { this.zoom.set(Number((event.target as HTMLInputElement).value)); }
}
