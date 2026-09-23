import {
  Component,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  computed,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { LucideImage } from '@lucide/angular';

interface MagnifierLayout {
  hostWidth: number;
  hostHeight: number;
  imageWidth: number;
  imageHeight: number;
  imageOffsetX: number;
  imageOffsetY: number;
  lensWidth: number;
  lensHeight: number;
}

/** 鑑賞頁平移動畫的位移範圍，需與 image-magnifier.scss 的 qmah-image-pan-* keyframes（±4%）一致。 */
const PAN_TRAVEL = 0.08;
/** 拖曳到畫卷尾端放開後，先停留這段時間再通知換段，讓使用者看清楚尾端畫面。 */
const SCRUB_END_DELAY_MS = 1000;
/** CSS ease-in-out 等同 cubic-bezier(0.42, 0, 0.58, 1)；拖曳需在時間進度與畫面位移之間互轉。 */
const EASE_X1 = 0.42;
const EASE_Y1 = 0;
const EASE_X2 = 0.58;
const EASE_Y2 = 1;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function bezier(t: number, p1: number, p2: number): number {
  const u = 1 - t;
  return 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t;
}

/** 貝茲曲線單調遞增，以二分法求出對應的參數 t。 */
function solveBezier(target: number, p1: number, p2: number): number {
  let low = 0;
  let high = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (low + high) / 2;
    if (bezier(mid, p1, p2) < target) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/** 時間進度 → 位移比例。 */
function easeInOut(progress: number): number {
  return bezier(solveBezier(progress, EASE_X1, EASE_X2), EASE_Y1, EASE_Y2);
}

/** 位移比例 → 時間進度。 */
function easeInOutInverse(offset: number): number {
  return bezier(solveBezier(offset, EASE_Y1, EASE_Y2), EASE_X1, EASE_X2);
}

interface PanScrub {
  pointerId: number;
  lastX: number;
  offset: number;
  animation: Animation;
  duration: number;
  width: number;
}

/** 商品詳情共用的局部放大鏡；不會放大整個商品欄位，也不建立第二份圖片資產。 */
@Component({
  selector: 'app-image-magnifier',
  imports: [LucideImage],
  templateUrl: './image-magnifier.html',
  styleUrl: './image-magnifier.scss',
})
export class ImageMagnifier implements OnChanges, OnDestroy {
  image = input<string | null>(null);
  alt = input('');
  fit = input<'cover' | 'contain'>('cover');
  /** 只在需要時啟用慢速平移，商品卡片維持原本的靜態放大行為。 */
  pan = input<'none' | 'forward' | 'backward'>('none');
  /** 由外層在換圖時切換，讓同一個元件也能重新開始平移動畫。 */
  panKey = input(0);
  panPaused = input(false);
  /** 鑑賞頁可讓鏡面常駐，避免使用者必須先猜到游標移入畫卷才會出現。 */
  persistentLens = input(false);
  /** 可由外層收起鏡面，只保留原圖與原本的平移狀態。 */
  enabled = input(true);
  /** 換圖時舊圖淡出的毫秒數；0 代表直接切換，商品頁維持原本行為。 */
  crossfade = input(0);
  /** 鏡面初始倍率；常駐鏡面以 1 作為互動縮放起點，商品頁維持固定的局部放大。 */
  baseZoom = input(2);
  /** 外層若旋轉了整個宿主（商品頁的觀看方向），需告知角度才能把游標換回宿主座標。 */
  rotation = input(0);
  loaded = output<{ width: number; height: number }>();
  draggingChange = output<boolean>();
  /** 平移動畫實際播完時通知外層，讓換段節奏跟著畫面，而不是另一個固定計時器。 */
  panEnd = output<void>();

  /** 換圖當下的舊圖快照，疊在新圖上淡出；key 讓連續換圖時重新開始淡出動畫。 */
  protected readonly fadingImages = signal<readonly { key: number; url: string; transform: string }[]>([]);
  private fadeKey = 0;

  protected active = signal(false);
  protected dragging = signal(false);
  protected position = signal({ x: 50, y: 50 });
  /** contain 版型的留白區沒有影像可取樣，游標移到那裡時收起鏡面，避免取樣點卡在圖片邊緣。 */
  protected readonly overImage = signal(true);
  /** 第一張圖片是否已載入；啟用 crossfade 時在此之前隱藏圖片，載入後淡入，避免大圖逐步顯示的閃爍。 */
  protected readonly revealed = signal(false);
  // 外層調整 baseZoom 時重新以其為起點，使用者的滾輪／捏合縮放仍可覆寫。
  protected readonly zoom = linkedSignal(() => this.baseZoom());
  protected readonly zoomPercent = computed(() => Math.round(this.zoom() * 100));
  private readonly minZoom = 1;
  private readonly maxZoom = 5;
  private readonly zoomStep = 0.25;
  private readonly layout = signal<MagnifierLayout | null>(null);
  private readonly panTick = signal(0);
  private observedHost: HTMLElement | null = null;
  private observedImage: HTMLImageElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private panFrame: number | null = null;
  private readonly activePointers = new Map<number, { x: number; y: number }>();
  private pinchStartDistance: number | null = null;
  private pinchStartZoom = 1;
  /** 拖曳畫卷時的起點資訊；null 代表目前的拖曳只移動鏡面。 */
  private scrub: PanScrub | null = null;
  /** 拖曳到尾端後延遲通知換段的計時器。 */
  private scrubEndTimer: ReturnType<typeof setTimeout> | null = null;
  /** 已由拖曳流程負責通知換段的動畫；它自然播完時不再重複通知。 */
  private scrubEndedAnimation: Animation | null = null;

  protected backgroundSize = computed(() => {
    const layout = this.layout();
    if (!layout) return `${this.zoom() * 100}cqw ${this.zoom() * 100}cqh`;
    this.panTick();
    const transform = this.imageTransform();
    return `${layout.imageWidth * transform.scaleX * this.zoom()}px ${layout.imageHeight * transform.scaleY * this.zoom()}px`;
  });

  protected backgroundPosition = computed(() => {
    const layout = this.layout();
    const point = this.position();
    if (!layout) return '50% 50%';

    // CSS owns the source-image pan animation. Read its current transform on
    // every frame so the lens samples the same pixels that are under the pointer.
    this.panTick();
    const lensCenterX = (point.x / 100) * layout.hostWidth;
    const lensCenterY = (point.y / 100) * layout.hostHeight;
    const transform = this.imageTransform();
    const untransformedX = layout.hostWidth / 2
      + (lensCenterX - layout.hostWidth / 2 - transform.translateX) / transform.scaleX;
    const untransformedY = layout.hostHeight / 2
      + (lensCenterY - layout.hostHeight / 2 - transform.translateY) / transform.scaleY;

    const imagePointX = clamp(untransformedX - layout.imageOffsetX, 0, layout.imageWidth);
    const imagePointY = clamp(untransformedY - layout.imageOffsetY, 0, layout.imageHeight);

    // background-position is relative to the lens itself, not the page. Anchor
    // the sampled source point to the lens centre. Including the source image's
    // live CSS scale keeps 100% identical to the pixels directly underneath.
    const imageLeft = layout.lensWidth / 2 - imagePointX * transform.scaleX * this.zoom();
    const imageTop = layout.lensHeight / 2 - imagePointY * transform.scaleY * this.zoom();
    return `${imageLeft}px ${imageTop}px`;
  });

  protected move(event: PointerEvent): void {
    if (!this.enabled()) return;
    const host = event.currentTarget as HTMLElement;
    if (!this.resizeObserver) this.updateLayout(host);
    this.updatePosition(host, event.clientX, event.clientY);
    this.active.set(true);
  }

  protected handlePointerMove(event: PointerEvent): void {
    if (!this.enabled()) return;
    const pointer = this.activePointers.get(event.pointerId);
    if (pointer) {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    }

    if (this.activePointers.size >= 2) {
      const distance = this.pointerDistance();
      if (distance && this.pinchStartDistance) {
        this.setZoom(this.pinchStartZoom * (distance / this.pinchStartDistance));
      }
      return;
    }

    if (this.scrub?.pointerId === event.pointerId) {
      this.scrubTo(event.clientX);
      // 滑鼠的鏡面本來就跟著游標；觸控拖曳畫卷時鏡面留在原處，不遮住正在移動的畫面。
      if (event.pointerType !== 'mouse') return;
    }

    this.move(event);
  }

  protected adjustZoom(event: WheelEvent): void {
    if (!this.enabled() || !this.persistentLens()) return;

    event.preventDefault();
    // Wheel events can arrive after the pointer has moved. Refresh the source
    // point first so the next zoom frame is anchored to the pixels under the
    // pointer, not to the previous lens position.
    this.updatePosition(event.currentTarget as HTMLElement, event.clientX, event.clientY);
    const direction = event.deltaY < 0 ? 1 : -1;
    this.setZoom(this.zoom() + direction * this.zoomStep);
  }

  /** Reset only the magnification, keeping the current lens position in view. */
  resetZoom(): void {
    this.setZoom(this.baseZoom());
    this.pinchStartZoom = this.zoom();
  }

  // ui-integration: 共用放大鏡保留商品頁的游標操作，並補上指標拖曳，讓長幅院藏影像可在觸控與滑鼠上檢視細節。
  protected startDrag(event: PointerEvent): void {
    if (!this.enabled()) return;
    const host = event.currentTarget as HTMLElement;
    // 重新拖曳代表使用者還在調整位置，先取消尾端的延遲換段，放開時再重新判斷。
    this.cancelScrubEnd();
    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    host.setPointerCapture?.(event.pointerId);
    if (!this.dragging()) {
      this.dragging.set(true);
      this.draggingChange.emit(true);
    }
    if (this.activePointers.size >= 2) {
      // 第二指落下即轉為捏合縮放，停止拖曳畫卷。
      this.scrub = null;
      this.pinchStartDistance = this.pointerDistance();
      this.pinchStartZoom = this.zoom();
      return;
    }

    // 滑鼠一律拖曳畫卷（鏡面隨游標移動）；觸控從鏡面開始拖是移動鏡面，從畫卷其他位置開始才是拖曳畫卷。
    const onLens = (event.target as HTMLElement | null)?.classList.contains('magnifier-lens') ?? false;
    if (event.pointerType === 'mouse' || !onLens) this.startScrub(event, host);
    if (!this.scrub || event.pointerType === 'mouse') this.move(event);
  }

  protected stopDrag(event: PointerEvent): void {
    const host = event.currentTarget as HTMLElement;
    if (host.hasPointerCapture?.(event.pointerId)) host.releasePointerCapture(event.pointerId);
    // 只移除這一個指標；捏合時抬起其中一指，另一指仍在拖曳中。
    this.activePointers.delete(event.pointerId);
    if (this.scrub?.pointerId === event.pointerId) this.finishScrub();

    if (this.activePointers.size < 2) {
      this.pinchStartDistance = null;
    }

    if (this.activePointers.size === 0 && this.dragging()) {
      this.dragging.set(false);
      this.draggingChange.emit(false);
    }
  }

  protected leave(): void {
    if (!this.dragging()) this.active.set(false);
  }

  protected moveWithKeyboard(event: KeyboardEvent): void {
    if (!this.enabled() || !this.persistentLens()) return;

    const step = event.shiftKey ? 10 : 4;
    if (event.key === '+' || (event.key === '=' && event.shiftKey)) {
      event.preventDefault();
      this.setZoom(this.zoom() + this.zoomStep);
      this.active.set(true);
      return;
    }
    if (event.key === '-') {
      event.preventDefault();
      this.setZoom(this.zoom() - this.zoomStep);
      this.active.set(true);
      return;
    }
    if (event.key === '0') {
      event.preventDefault();
      this.resetZoom();
      this.active.set(true);
      return;
    }

    const point = this.position();
    let x = point.x;
    let y = point.y;

    if (event.key === 'ArrowLeft') x -= step;
    else if (event.key === 'ArrowRight') x += step;
    else if (event.key === 'ArrowUp') y -= step;
    else if (event.key === 'ArrowDown') y += step;
    else return;

    event.preventDefault();
    this.position.set({ x: clamp(x, 0, 100), y: clamp(y, 0, 100) });
    this.active.set(true);
  }

  protected onLoad(event: Event): void {
    this.revealed.set(true);
    const image = event.currentTarget as HTMLImageElement;
    const host = image.parentElement;
    this.observedHost = host;
    this.observedImage = image;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    if (host && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.updateLayout());
      this.resizeObserver.observe(host);
    }
    this.updateLayout();
    this.startPanSync();
    this.loaded.emit({ width: image.naturalWidth, height: image.naturalHeight });
  }

  protected onPanEnd(event: AnimationEvent): void {
    if (this.pan() === 'none' || event.target !== event.currentTarget) return;
    const animation = this.panAnimation();
    if (animation && animation === this.scrubEndedAnimation) return;
    this.panEnd.emit();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const change = changes['image'];
    if (!change || change.firstChange || this.crossfade() <= 0) return;

    const previous = change.previousValue as string | null;
    const image = this.observedImage;
    if (!previous || !image || previous === change.currentValue) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    // ngOnChanges 在畫面更新前執行：此刻 <img> 仍是舊圖與它當下的平移位置，凍結成快照再淡出，
    // 新圖則在下方從平移起點開始，兩者交疊成淡入淡出。
    const transform = getComputedStyle(image).transform;
    this.fadingImages.set([
      { key: ++this.fadeKey, url: previous, transform: transform === 'none' ? '' : transform },
    ]);
  }

  protected onFadeEnd(key: number): void {
    this.fadingImages.update((fades) => fades.filter((fade) => fade.key !== key));
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.cancelScrubEnd();
    if (this.panFrame !== null) cancelAnimationFrame(this.panFrame);
    this.activePointers.clear();
  }

  private setZoom(value: number): void {
    const next = clamp(value, this.minZoom, this.maxZoom);
    this.zoom.set(Math.round(next * 100) / 100);
  }

  /** 宿主的版面尺寸；getBoundingClientRect 會帶入祖先 transform，旋轉時（含過場中）長寬會失真。 */
  private hostSize(host: HTMLElement): { width: number; height: number } {
    return { width: host.offsetWidth, height: host.offsetHeight };
  }

  private updatePosition(host: HTMLElement, clientX: number, clientY: number): void {
    const rect = host.getBoundingClientRect();
    const { width, height } = this.hostSize(host);
    if (!width || !height) return;

    // 以外框中心為軸做反向旋轉，把視窗座標換回宿主自己的座標系；未旋轉時等同原本的線性換算。
    const angle = (((this.rotation() % 360) + 360) % 360) * (Math.PI / 180);
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    const localX = width / 2 + dx * Math.cos(angle) + dy * Math.sin(angle);
    const localY = height / 2 - dx * Math.sin(angle) + dy * Math.cos(angle);

    this.position.set({
      x: clamp((localX / width) * 100, 0, 100),
      y: clamp((localY / height) * 100, 0, 100),
    });

    const layout = this.layout();
    this.overImage.set(
      !layout
        || this.fit() !== 'contain'
        || (localX >= layout.imageOffsetX
          && localX <= layout.imageOffsetX + layout.imageWidth
          && localY >= layout.imageOffsetY
          && localY <= layout.imageOffsetY + layout.imageHeight),
    );
  }

  private startPanSync(): void {
    if (this.pan() === 'none' || this.panFrame !== null) return;
    const tick = () => {
      if (!this.observedImage) {
        this.panFrame = null;
        return;
      }
      this.panTick.update((value) => value + 1);
      this.panFrame = requestAnimationFrame(tick);
    };
    this.panFrame = requestAnimationFrame(tick);
  }

  private imageTransform(): { scaleX: number; scaleY: number; translateX: number; translateY: number } {
    const transform = this.observedImage ? getComputedStyle(this.observedImage).transform : 'none';
    // computed transform 只會是 none、matrix() 或 matrix3d()；DOMMatrix 的 a/d 為縮放、e/f 為位移，兩種形式通用。
    const matrix = new DOMMatrixReadOnly(transform === 'none' ? undefined : transform);
    return {
      scaleX: Math.abs(matrix.a) || 1,
      scaleY: Math.abs(matrix.d) || 1,
      translateX: matrix.e,
      translateY: matrix.f,
    };
  }

  /** 圖片上的平移動畫；第一張圖片淡入的 opacity 過渡也在同一個元素上，且排序在前，不能直接取第一個。 */
  private panAnimation(): Animation | undefined {
    return this.observedImage?.getAnimations?.().find((animation) => animation instanceof CSSAnimation);
  }

  private startScrub(event: PointerEvent, host: HTMLElement): void {
    this.scrub = null;
    if (this.pan() === 'none') return;

    // 平移由 CSS 動畫負責；拖曳時直接改動畫的播放位置，鏡面取樣會照常讀到當下的 transform。
    const animation = this.panAnimation();
    const duration = Number(animation?.effect?.getComputedTiming().duration);
    const width = this.hostSize(host).width;
    if (!animation || !duration || !width) return;

    const currentTime = typeof animation.currentTime === 'number' ? animation.currentTime : 0;
    const progress = clamp(currentTime / duration, 0, 1);
    this.scrub = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      offset: easeInOut(progress),
      animation,
      duration,
      width,
    };
  }

  private scrubTo(clientX: number): void {
    const scrub = this.scrub;
    if (!scrub) return;

    // 往右拖時畫面也往右移；backward 的 keyframes 方向相反。逐次累加，拖到盡頭後反向可立即回應。
    const direction = this.pan() === 'backward' ? -1 : 1;
    const delta = (direction * (clientX - scrub.lastX)) / (scrub.width * PAN_TRAVEL);
    scrub.offset = clamp(scrub.offset + delta, 0, 1);
    scrub.lastX = clientX;

    // 停在終點前 1ms：放開後動畫會自然播完並觸發 animationend 換段，不會卡在已結束的狀態。
    scrub.animation.currentTime = Math.min(
      scrub.duration - 1,
      easeInOutInverse(scrub.offset) * scrub.duration,
    );
  }

  /** 放開拖曳：停在尾端時由這裡延遲通知換段，否則交回動畫自然播完的流程。 */
  private finishScrub(): void {
    const scrub = this.scrub;
    this.scrub = null;
    if (!scrub) return;

    if (scrub.offset < 1) {
      this.scrubEndedAnimation = null;
      return;
    }

    this.scrubEndedAnimation = scrub.animation;
    this.scrubEndTimer = setTimeout(() => {
      this.scrubEndTimer = null;
      // 延遲期間若已換段或速度重設，舊動畫已被取消，不再通知。
      if (this.panAnimation() !== scrub.animation) return;
      this.panEnd.emit();
    }, SCRUB_END_DELAY_MS);
  }

  private cancelScrubEnd(): void {
    if (this.scrubEndTimer !== null) clearTimeout(this.scrubEndTimer);
    this.scrubEndTimer = null;
  }

  private pointerDistance(): number | null {
    const pointers = [...this.activePointers.values()];
    if (pointers.length < 2) return null;

    const [first, second] = pointers;
    return Math.hypot(second.x - first.x, second.y - first.y);
  }

  private updateLayout(host = this.observedHost, image = this.observedImage): void {
    if (!host || !image?.naturalWidth || !image.naturalHeight) return;

    const { width: hostWidth, height: hostHeight } = this.hostSize(host);
    if (!hostWidth || !hostHeight) return;

    const scale =
      this.fit() === 'contain'
        ? Math.min(hostWidth / image.naturalWidth, hostHeight / image.naturalHeight)
        : Math.max(hostWidth / image.naturalWidth, hostHeight / image.naturalHeight);
    const imageWidth = image.naturalWidth * scale;
    const imageHeight = image.naturalHeight * scale;
    const lens = host.querySelector<HTMLElement>('.magnifier-lens');

    // Keep the same centered object-fit geometry as the source image, including letterbox/crop.
    this.layout.set({
      hostWidth,
      hostHeight,
      imageWidth,
      imageHeight,
      imageOffsetX: (hostWidth - imageWidth) / 2,
      imageOffsetY: (hostHeight - imageHeight) / 2,
      // background-position 的定位區是 padding-box，clientWidth 才不含鏡框的 2px 邊線。
      lensWidth: lens?.clientWidth || 132,
      lensHeight: lens?.clientHeight || 132,
    });
  }
}
