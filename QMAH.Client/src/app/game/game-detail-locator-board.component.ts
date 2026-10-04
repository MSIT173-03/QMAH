import { Component, DestroyRef, ElementRef, ViewChild, computed, effect, inject, input, output, signal } from '@angular/core';
import { ImageMagnifier } from '../store/component/image-magnifier/image-magnifier';
import { MiniGameArtifact } from './game.models';
import { GameAudio } from './game-audio.service';
import { LocatorAnswer, locatorCorrect, locatorTarget } from './game-detail-locator';

@Component({
  selector: 'app-game-detail-locator-board',
  imports: [ImageMagnifier],
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
  readonly pendingPoint = signal<LocatorAnswer | null>(null);
  // 確認位置後，在落點旁立刻跳出一句回饋
  readonly verdict = signal<{ artifactId: string; text: string; tier: 'great' | 'nice' | 'close' | 'bad'; x: number; y: number } | null>(null);
  private verdictTimer = 0;
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
  @ViewChild('sourceFrame') private sourceFrame?: ElementRef<HTMLElement>;

  private readonly audio = inject(GameAudio);
  private answered = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => window.clearTimeout(this.verdictTimer));
    effect(() => {
      const count = this.answers().length;
      if (count > this.answered) this.audio.play(this.lastCorrect() ? 'success' : 'error');
      this.answered = count;
    });
    effect(() => {
      this.current(); this.revision();
      this.ready.set(false); this.failed.set(false); this.keyboardCursor.set(false); this.cursor.set({ x: .5, y: .5 }); this.pendingPoint.set(null);
      this.availabilityChange.emit(false);
    });
  }

  renderClue(image: HTMLImageElement): void {
    const canvas = this.canvas?.nativeElement;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || !image.naturalWidth || !image.naturalHeight) { this.unavailable(); return; }
    const size = Math.max(1, Math.floor(Math.min(image.naturalWidth, image.naturalHeight) / 5));
    canvas.width = size; canvas.height = size;
    this.dimensions.set({ imageWidth: image.naturalWidth, imageHeight: image.naturalHeight });
    context.drawImage(image, image.naturalWidth * this.target().x - size / 2, image.naturalHeight * this.target().y - size / 2, size, size, 0, 0, size, size);
    this.ready.set(true); this.failed.set(false); this.availabilityChange.emit(true);
  }
  private answerAt(point: { x: number; y: number }): LocatorAnswer {
    return { artifactId: this.current().artifactId, ...point, ...this.dimensions() };
  }
  sourceLoaded(size: { width: number; height: number }): void { this.dimensions.set({ imageWidth: size.width, imageHeight: size.height }); }
  imageBounds(): { left: number; top: number; width: number; height: number } {
    const host = this.sourceFrame?.nativeElement.querySelector<HTMLElement>('.magnifier-host');
    const rect = host?.getBoundingClientRect();
    const { imageWidth, imageHeight } = this.dimensions();
    if (!rect?.width || !rect.height || !imageWidth || !imageHeight) return { left: 0, top: 0, width: 100, height: 100 };
    const scale = Math.min(rect.width / imageWidth, rect.height / imageHeight);
    const width = imageWidth * scale / rect.width * 100;
    const height = imageHeight * scale / rect.height * 100;
    return { left: (100 - width) / 2, top: (100 - height) / 2, width, height };
  }
  pointOnImage(point: { x: number; y: number }, axis: 'x' | 'y'): number {
    const bounds = this.imageBounds();
    return axis === 'x' ? bounds.left + point.x * bounds.width : bounds.top + point.y * bounds.height;
  }
  unavailable(): void { this.ready.set(false); this.failed.set(true); this.availabilityChange.emit(false); }
  retry(): void { this.revision.update(value => value + 1); }
  locate(event: MouseEvent): void {
    if (!this.ready() || this.disabled() || this.finished()) return;
    const host = (event.currentTarget as HTMLElement).querySelector<HTMLElement>('.magnifier-host');
    const rect = host?.getBoundingClientRect();
    const { imageWidth, imageHeight } = this.dimensions();
    if (!rect?.width || !rect.height || !imageWidth || !imageHeight) return;
    const scale = Math.min(rect.width / imageWidth, rect.height / imageHeight);
    const width = imageWidth * scale;
    const height = imageHeight * scale;
    const left = rect.left + (rect.width - width) / 2;
    const top = rect.top + (rect.height - height) / 2;
    const point = event.detail === 0 ? this.cursor() : { x: (event.clientX - left) / width, y: (event.clientY - top) / height };
    if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) return;
    this.cursor.set(point);
    this.keyboardCursor.set(false);
    this.pendingPoint.set(this.answerAt(point));
  }
  confirmLocation(): void {
    const point = this.pendingPoint();
    if (!point || this.disabled() || this.finished()) return;
    this.showVerdict(point);
    this.pendingPoint.set(null);
    this.pointChosen.emit(point);
  }
  private showVerdict(point: LocatorAnswer): void {
    const target = this.target();
    const half = Math.floor(Math.min(point.imageWidth, point.imageHeight) / 5) / 2;
    const ratio = Math.max(Math.abs(point.x - target.x) * point.imageWidth, Math.abs(point.y - target.y) * point.imageHeight) / (half || 1);
    const [tier, text] = ratio <= .4 ? ['great', '太準了！'] as const : ratio <= 1 ? ['nice', '命中'] as const : ratio <= 2 ? ['close', '差一點'] as const : ['bad', '偏了'] as const;
    this.verdict.set({ artifactId: point.artifactId, text, tier, x: point.x, y: point.y });
    window.clearTimeout(this.verdictTimer);
    this.verdictTimer = window.setTimeout(() => this.verdict.set(null), 1300);
  }
  advanceDemonstration(): void {
    if (!this.ready() || this.disabled() || this.finished()) return;
    if (!this.keyboardCursor()) { this.cursor.set(this.target()); this.keyboardCursor.set(true); }
    else if (!this.pendingPoint()) this.pendingPoint.set(this.answerAt(this.target()));
    else this.confirmLocation();
  }
  moveCursor(event: KeyboardEvent): void {
    if (!this.ready() || this.disabled() || this.finished()) return;
    if (event.target !== event.currentTarget) return;
    const step = event.shiftKey ? .1 : .02;
    const directions: Record<string, { x: number; y: number }> = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault(); this.keyboardCursor.set(true);
    const point = this.cursor();
    const next = { x: Math.max(0, Math.min(1, point.x + direction.x)), y: Math.max(0, Math.min(1, point.y + direction.y)) };
    this.cursor.set(next);
    this.pendingPoint.set(this.answerAt(next));
  }
}
