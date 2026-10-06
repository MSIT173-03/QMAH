import { Component, DestroyRef, ElementRef, ViewChild, computed, effect, inject, input, output, signal } from '@angular/core';
import { MiniGameArtifact } from './game.models';
import { GameAudio } from './game-audio.service';
import { GameLoupeControlsComponent, LoupeSizeId, loadLoupePrefs, loupePixels, saveLoupePrefs, wheelZoom } from './game-loupe';
import { LocatorAnswer, locatorCorrect, locatorTarget, rememberLocatorTargets } from './game-detail-locator';

@Component({
  selector: 'app-game-detail-locator-board',
  imports: [GameLoupeControlsComponent],
  templateUrl: './game-detail-locator-board.component.html',
  styleUrl: './game-detail-locator-board.component.scss'
})
export class GameDetailLocatorBoardComponent {
  readonly artifacts = input.required<MiniGameArtifact[]>();
  readonly seed = input.required<string>();
  readonly targets = input<readonly { artifactId: string; x: number; y: number }[] | null>(null);
  readonly answers = input<LocatorAnswer[]>([]);
  /** 按「協助完成」代為完成的題目；盤面視為完成，可以檢視正解位置。 */
  readonly assisted = input<string[]>([]);
  readonly disabled = input(false);
  readonly showInstructions = input(true);
  readonly hintedArtifactId = input<string | null>(null);
  readonly pointChosen = output<LocatorAnswer>();
  readonly feedbackChange = output<boolean>();
  readonly reviewing = signal(false);
  readonly availabilityChange = output<boolean>();
  // 放大倍率與「第一次提示」是否看過，都記在這台瀏覽器
  private readonly prefs = loadLoupePrefs();
  readonly zoom = signal(this.prefs.zoom);
  readonly lensSize = signal<LoupeSizeId>(this.prefs.size);
  /** 放大鏡可以關掉：關掉後點哪裡就選哪裡，不會有鏡面跟著游標。 */
  readonly loupeOn = signal(this.prefs.on);
  readonly lens = signal<{ x: number; y: number; url: string; size: string; pos: string } | null>(null);
  private pressed = false;
  readonly hintSeen = signal(this.stored('qmah.game.locator-hint') === '1');
  readonly hintPos = signal<{ x: number; y: number } | null>(null);
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
  /** 原圖寬高比：讓右側原圖面板貼著圖片大小，不留左右空白。 */
  readonly sourceRatio = computed(() => { const { imageWidth, imageHeight } = this.dimensions(); return imageWidth && imageHeight ? imageWidth / imageHeight : 1; });
  /** 全部定位完成後，可以來回切換第 1～4 件，復盤自己當時點在哪裡。 */
  readonly reviewIndex = signal<number | null>(null);
  readonly shownIndex = computed(() => {
    const last = Math.max(0, this.artifacts().length - 1);
    const review = this.reviewIndex();
    return this.finished() && review !== null ? Math.min(review, last) : Math.min(this.answers().length, last);
  });
  readonly shownAnswer = computed(() => this.finished() ? this.answers()[this.shownIndex()] ?? null : null);
  review(index: number): void { if (this.finished()) this.reviewIndex.set(index); }
  readonly roundNumber = computed(() => this.shownIndex() + 1);
  readonly current = computed(() => this.artifacts()[this.shownIndex()]);
  readonly target = computed(() => { rememberLocatorTargets(this.seed(), this.targets()); return locatorTarget(this.seed(), this.current()?.artifactId ?? ''); });
  readonly finished = computed(() => this.artifacts().length > 0 && this.answers().length + this.assisted().length >= this.artifacts().length);
  readonly lastAnswer = computed(() => this.answers().at(-1));
  readonly lastCorrect = computed(() => (rememberLocatorTargets(this.seed(), this.targets()), !!this.lastAnswer()) && locatorCorrect(this.seed(), this.lastAnswer()!));
  readonly hintVisible = computed(() => this.hintedArtifactId() === this.current()?.artifactId && !this.finished());
  @ViewChild('clueCanvas') private canvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('sourceFrame') private sourceFrame?: ElementRef<HTMLElement>;
  @ViewChild('sourceImg') private sourceImg?: ElementRef<HTMLImageElement>;

  private readonly audio = inject(GameAudio);
  private answered = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => window.clearTimeout(this.verdictTimer));
    effect(() => { if (!this.finished()) this.reviewIndex.set(null); });
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
  imageLoaded(event: Event): void {
    const image = event.target as HTMLImageElement;
    this.sourceLoaded({ width: image.naturalWidth, height: image.naturalHeight });
    this.renderClue(image);
  }
  /** 圖片實際顯示的範圍，換算成原圖框裡的百分比。 */
  imageBounds(): { left: number; top: number; width: number; height: number } {
    const frame = this.sourceFrame?.nativeElement.getBoundingClientRect();
    const image = this.sourceImg?.nativeElement.getBoundingClientRect();
    if (!frame?.width || !frame.height || !image?.width || !image.height) return { left: 0, top: 0, width: 100, height: 100 };
    return { left: (image.left - frame.left) / frame.width * 100, top: (image.top - frame.top) / frame.height * 100, width: image.width / frame.width * 100, height: image.height / frame.height * 100 };
  }
  pointOnImage(point: { x: number; y: number }, axis: 'x' | 'y'): number {
    const bounds = this.imageBounds();
    return axis === 'x' ? bounds.left + point.x * bounds.width : bounds.top + point.y * bounds.height;
  }
  unavailable(): void { this.ready.set(false); this.failed.set(true); this.availabilityChange.emit(false); }
  retry(): void { this.revision.update(value => value + 1); }
  private stored(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
  private store(key: string, value: string): void { try { localStorage.setItem(key, value); } catch { /* 無法儲存時只影響這次 */ } }
  trackHint(event: PointerEvent): void {
    if (this.hintSeen()) return;
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.hintPos.set({ x: (event.clientX - box.left) / box.width * 100, y: (event.clientY - box.top) / box.height * 100 });
  }
  /** 放大鏡與倍率合成一個選擇：0 = 關閉，其餘是倍率。 */
  setLoupe(level: number): void { this.lens.set(null); this.loupeOn.set(level > 0); saveLoupePrefs({ on: level > 0 }); if (level > 0) this.setZoom(level); }
  setZoom(level: number): void { this.zoom.set(level); saveLoupePrefs({ zoom: level }); }
  setLensSize(size: LoupeSizeId): void { this.lensSize.set(size); saveLoupePrefs({ size }); }
  /** 指標落在圖片上的位置（0–1）；不在圖片上則回傳 null。 */
  private pointAt(event: MouseEvent): { x: number; y: number } | null {
    if (this.reviewing()) return null;
    const image = this.sourceImg?.nativeElement.getBoundingClientRect();
    if (!image?.width || !image.height) return null;
    const x = (event.clientX - image.left) / image.width, y = (event.clientY - image.top) / image.height;
    return x < 0 || x > 1 || y < 0 || y > 1 ? null : { x, y };
  }
  private showLens(event: MouseEvent): void {
    if (!this.loupeOn()) { this.lens.set(null); return; }
    const frame = this.sourceFrame?.nativeElement.getBoundingClientRect();
    const image = this.sourceImg?.nativeElement;
    const rect = image?.getBoundingClientRect();
    const point = this.pointAt(event);
    if (!frame || !image || !rect || !point || !this.ready() || this.disabled() || this.finished()) { this.lens.set(null); return; }
    const size = Math.min(loupePixels(this.lensSize()), frame.width * .6);
    const touch = 'pointerType' in event && event.pointerType !== 'mouse';
    const x = event.clientX - frame.left;
    // 觸控時鏡面浮在手指上方，不會被手指擋住；靠近上緣就改放到下方
    let y = event.clientY - frame.top - (touch ? size * .85 : 0);
    if (touch && y < size / 2) y = event.clientY - frame.top + size * .85;
    const zoom = this.zoom();
    this.sourceFrame!.nativeElement.style.setProperty('--loupe', size + 'px');
    this.lens.set({ x, y, url: image.currentSrc || image.src, size: `${rect.width * zoom}px ${rect.height * zoom}px`, pos: `${size / 2 - point.x * rect.width * zoom}px ${size / 2 - point.y * rect.height * zoom}px` });
  }
  /** 滾輪與按鈕兩種方式都能調倍率：每滾一格換一檔，鏡面留在游標下。 */
  lensWheel(event: WheelEvent): void {
    if (!this.ready()) return;
    event.preventDefault();
    if (!this.loupeOn()) { if (event.deltaY < 0) this.setLoupe(this.zoom()); return; }
    this.setZoom(wheelZoom(this.zoom(), event.deltaY));
    this.showLens(event);
  }
  lensDown(event: PointerEvent): void {
    if (event.button !== 0 || !this.ready() || this.disabled() || this.finished()) return;
    this.pressed = true;
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    this.showLens(event);
  }
  lensMove(event: PointerEvent): void {
    this.trackHint(event);
    if (event.pointerType === 'mouse' || this.pressed) this.showLens(event);
  }
  lensUp(event: PointerEvent): void {
    if (!this.pressed) return;
    this.pressed = false;
    const point = this.pointAt(event);
    if (point && this.ready() && !this.disabled() && !this.finished()) {
      if (!this.hintSeen()) { this.hintSeen.set(true); this.store('qmah.game.locator-hint', '1'); }
      this.cursor.set(point); this.keyboardCursor.set(false); this.pendingPoint.set(this.answerAt(point));
    }
    // 滑鼠放開後鏡面繼續跟著游標；觸控放開就收起
    if (event.pointerType !== 'mouse') this.lens.set(null); else this.showLens(event);
  }
  lensCancel(): void { this.pressed = false; this.lens.set(null); }
  lensLeave(event: PointerEvent): void { if (event.pointerType === 'mouse' && !this.pressed) this.lens.set(null); }
  /** 只處理鍵盤觸發的點擊（Enter／空白鍵）；滑鼠與觸控已在放開時選定位置。 */
  locate(event: MouseEvent): void {
    if (event.detail !== 0 || !this.ready() || this.disabled() || this.finished()) return;
    this.keyboardCursor.set(false);
    this.pendingPoint.set(this.answerAt(this.cursor()));
  }
  confirmLocation(): void {
    const point = this.pendingPoint();
    if (!point || this.disabled() || this.finished() || this.reviewing()) return;
    this.reviewing.set(true);
    this.feedbackChange.emit(true);
    this.showVerdict(point);
    this.pendingPoint.set(null);
    this.lens.set(null);
    window.clearTimeout(this.verdictTimer);
    this.verdictTimer = window.setTimeout(() => {
      this.reviewing.set(false);
      this.verdict.set(null);
      this.pointChosen.emit(point);
      this.feedbackChange.emit(false);
    }, 1500);
  }
  private showVerdict(point: LocatorAnswer): void {
    const target = this.target();
    const half = Math.floor(Math.min(point.imageWidth, point.imageHeight) / 5) / 2;
    const ratio = Math.max(Math.abs(point.x - target.x) * point.imageWidth, Math.abs(point.y - target.y) * point.imageHeight) / (half || 1);
    const [tier, text] = ratio <= .4 ? ['great', '太準了！'] as const : ratio <= 1 ? ['nice', '命中'] as const : ratio <= 2 ? ['close', '差一點'] as const : ['bad', '偏了'] as const;
    this.verdict.set({ artifactId: point.artifactId, text, tier, x: point.x, y: point.y });
  }
  advanceDemonstration(): void {
    if (!this.ready() || this.disabled() || this.finished() || this.reviewing()) return;
    if (!this.keyboardCursor()) { this.cursor.set(this.target()); this.keyboardCursor.set(true); }
    else if (!this.pendingPoint()) this.pendingPoint.set(this.answerAt(this.target()));
    else this.confirmLocation();
  }
  moveCursor(event: KeyboardEvent): void {
    if (!this.ready() || this.disabled() || this.finished() || this.reviewing()) return;
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
