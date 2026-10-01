import { Component, ElementRef, Input, OnChanges, ViewChild, output } from '@angular/core';

/** Three distinct details from the same work, without revealing the entire photograph. */
@Component({
  selector: 'app-game-detail-clue',
  template: `
    <figure class="clue-study">
      <div class="clue-image">
        <div class="clue-fragments" [hidden]="!ready">
          <canvas #canvas class="clue-image__zoom" role="img" aria-label="文物中央的局部線索" [style.width.px]="displaySize"></canvas>
          <canvas #secondCanvas class="clue-image__zoom" role="img" aria-label="文物左側的局部線索" [style.width.px]="displaySize"></canvas>
          <canvas #thirdCanvas class="clue-image__zoom" role="img" aria-label="文物右下方的局部線索" [style.width.px]="displaySize"></canvas>
        </div>
        @if (!ready) {
          <div class="clue-status" role="status">
            {{ failed ? '線索圖片暫時無法顯示' : '正在準備線索…' }}
            @if (failed) { <button type="button" (click)="retry()">重新載入圖片</button> }
          </div>
        }
        @for (version of [revision]; track version) {
          <img hidden [src]="image" alt="" (load)="render($event)" (error)="unavailable()" />
        }
      </div>
      <figcaption>三處細節，同一件文物</figcaption>
      <span class="clue-rule" aria-hidden="true"></span>
    </figure>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .clue-study { margin: 0; display: grid; justify-items: center; gap: 20px; }
    .clue-image { display: grid; place-items: center; width: 100%; min-height: 240px; padding: 24px; }
    .clue-fragments { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); justify-items: center; align-items: center; gap: 20px; width: 100%; }
    canvas:first-child { grid-column: 1 / -1; }
    canvas { display: block; max-width: 100%; height: auto; border-radius: 4px;
      box-shadow: 0 16px 32px color-mix(in srgb, var(--qmah-night) 40%, transparent); }
    [hidden] { display: none !important; }
    figcaption { color: var(--clue-ink, var(--qmah-muted)); font-size: 14px; text-align: center; }
    .clue-rule { width: 80px; height: 1px; background: var(--clue-ink, var(--qmah-border)); opacity: .5; }
    .clue-status { display: grid; justify-items: center; gap: 12px; color: var(--clue-ink, var(--qmah-muted)); }
    button { min-height: 44px; padding: 8px 16px; font: inherit; border: 1px solid var(--qmah-border);
      border-radius: var(--qmah-radius-control); background: var(--qmah-surface); color: var(--qmah-ink); cursor: pointer; }
    button:focus-visible { outline: 3px solid var(--qmah-focus); outline-offset: 4px; }
    @media (max-width: 600px) { .clue-image { min-height: 120px; padding: 12px 0; } .clue-study { gap: 12px; } .clue-fragments { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; } canvas:first-child { grid-column: auto; } }
  `
})
export class GameDetailClueComponent implements OnChanges {
  @Input({ required: true }) image = '';
  @Input() cropX = .5;
  @Input() cropY = .5;
  @ViewChild('canvas', { static: true }) private canvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('secondCanvas', { static: true }) private secondCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('thirdCanvas', { static: true }) private thirdCanvas!: ElementRef<HTMLCanvasElement>;
  readonly availabilityChange = output<boolean>();
  ready = false;
  failed = false;
  revision = 0;
  displaySize = 0;

  ngOnChanges(): void { this.retry(); }
  retry(): void {
    this.ready = false;
    this.failed = false;
    this.revision++;
    this.availabilityChange.emit(false);
  }
  unavailable(): void { this.ready = false; this.failed = true; this.availabilityChange.emit(false); }
  render(event: Event): void {
    const source = event.target as HTMLImageElement;
    const size = Math.floor(Math.min(source.naturalWidth, source.naturalHeight) / 5);
    if (size < 1) { this.unavailable(); return; }
    const fragments = [
      { canvas: this.canvas.nativeElement, x: this.cropX, y: this.cropY },
      { canvas: this.secondCanvas.nativeElement, x: this.cropX - .23, y: this.cropY },
      { canvas: this.thirdCanvas.nativeElement, x: this.cropX + .14, y: this.cropY + .23 }
    ];
    for (const fragment of fragments) {
      const context = fragment.canvas.getContext('2d');
      if (!context) { this.unavailable(); return; }
      const x = Math.max(0, Math.min(source.naturalWidth - size, source.naturalWidth * fragment.x - size / 2));
      const y = Math.max(0, Math.min(source.naturalHeight - size, source.naturalHeight * fragment.y - size / 2));
      fragment.canvas.width = size;
      fragment.canvas.height = size;
      context.drawImage(source, x, y, size, size, 0, 0, size, size);
    }
    // A larger frame cannot create detail that is absent in the source photograph.
    this.displaySize = Math.min(320, size * 1.5);
    this.ready = true;
    this.failed = false;
    this.availabilityChange.emit(true);
  }
}
