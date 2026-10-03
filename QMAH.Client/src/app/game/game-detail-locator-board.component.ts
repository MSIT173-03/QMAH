import { Component, ElementRef, ViewChild, computed, effect, input, output, signal } from '@angular/core';
import { MiniGameArtifact } from './game.models';
import { LocatorAnswer, locatorCorrect, locatorTarget } from './game-detail-locator';

@Component({
  selector: 'app-game-detail-locator-board',
  templateUrl: './game-detail-locator-board.component.html',
  styleUrl: './game-detail-locator-board.component.scss'
})
export class GameDetailLocatorBoardComponent {
  readonly artifacts = input.required<MiniGameArtifact[]>();
  readonly seed = input.required<string>();
  readonly answers = input<LocatorAnswer[]>([]);
  readonly disabled = input(false);
  readonly hintedArtifactId = input<string | null>(null);
  readonly pointChosen = output<LocatorAnswer>();
  readonly availabilityChange = output<boolean>();
  readonly ready = signal(false);
  readonly failed = signal(false);
  readonly revision = signal(0);
  readonly cursor = signal({ x: .5, y: .5 });
  readonly keyboardCursor = signal(false);
  readonly dimensions = signal({ imageWidth: 0, imageHeight: 0 });
  readonly roundNumber = computed(() => Math.min(this.answers().length + 1, this.artifacts().length));
  readonly current = computed(() => this.artifacts()[Math.min(this.answers().length, this.artifacts().length - 1)]);
  readonly target = computed(() => locatorTarget(this.seed(), this.current()?.artifactId ?? ''));
  readonly finished = computed(() => this.artifacts().length > 0 && this.answers().length === this.artifacts().length);
  readonly lastAnswer = computed(() => this.answers().at(-1));
  readonly lastCorrect = computed(() => !!this.lastAnswer() && locatorCorrect(this.seed(), this.lastAnswer()!));
  readonly hintVisible = computed(() => this.hintedArtifactId() === this.current()?.artifactId && !this.finished());
  @ViewChild('clueCanvas') private canvas?: ElementRef<HTMLCanvasElement>;

  constructor() {
    effect(() => {
      this.current(); this.revision();
      this.ready.set(false); this.failed.set(false); this.keyboardCursor.set(false); this.cursor.set({ x: .5, y: .5 });
      this.availabilityChange.emit(false);
    });
  }

  render(event: Event): void {
    const image = event.target as HTMLImageElement;
    const canvas = this.canvas?.nativeElement;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || !image.naturalWidth || !image.naturalHeight) { this.unavailable(); return; }
    const size = Math.max(1, Math.floor(Math.min(image.naturalWidth, image.naturalHeight) / 5));
    canvas.width = size; canvas.height = size;
    this.dimensions.set({ imageWidth: image.naturalWidth, imageHeight: image.naturalHeight });
    context.drawImage(image, image.naturalWidth * this.target().x - size / 2, image.naturalHeight * this.target().y - size / 2, size, size, 0, 0, size, size);
    this.ready.set(true); this.failed.set(false); this.availabilityChange.emit(true);
  }
  unavailable(): void { this.ready.set(false); this.failed.set(true); this.availabilityChange.emit(false); }
  retry(): void { this.revision.update(value => value + 1); }
  locate(event: MouseEvent): void {
    if (!this.ready() || this.disabled() || this.finished()) return;
    const bounds = (event.currentTarget as HTMLElement).querySelector('img')!.getBoundingClientRect();
    const point = event.detail === 0 ? this.cursor() : {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))
    };
    this.pointChosen.emit({ artifactId: this.current().artifactId, ...point, ...this.dimensions() });
  }
  advanceDemonstration(): void {
    if (!this.ready() || this.disabled() || this.finished()) return;
    if (!this.keyboardCursor()) { this.cursor.set(this.target()); this.keyboardCursor.set(true); }
    else this.pointChosen.emit({ artifactId: this.current().artifactId, ...this.target(), ...this.dimensions() });
  }
  moveCursor(event: KeyboardEvent): void {
    if (!this.ready() || this.disabled() || this.finished()) return;
    const step = event.shiftKey ? .1 : .02;
    const directions: Record<string, { x: number; y: number }> = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault(); this.keyboardCursor.set(true);
    this.cursor.update(point => ({ x: Math.max(0, Math.min(1, point.x + direction.x)), y: Math.max(0, Math.min(1, point.y + direction.y)) }));
  }
}
