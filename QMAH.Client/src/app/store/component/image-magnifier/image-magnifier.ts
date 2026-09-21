import { Component, OnDestroy, computed, input, output, signal } from '@angular/core';
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

/** 商品詳情共用的局部放大鏡；不會放大整個商品欄位，也不建立第二份圖片資產。 */
@Component({
  selector: 'app-image-magnifier',
  imports: [LucideImage],
  templateUrl: './image-magnifier.html',
  styleUrl: './image-magnifier.scss',
})
export class ImageMagnifier implements OnDestroy {
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
  loaded = output<{ width: number; height: number }>();
  draggingChange = output<boolean>();

  protected active = signal(false);
  protected dragging = signal(false);
  protected position = signal({ x: 50, y: 50 });
  protected readonly zoom = signal(1);
  protected readonly zoomPercent = computed(() => Math.round(this.zoom() * 100));
  private readonly defaultZoom = 1;
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
  private pinchStartZoom = this.zoom();

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

    const imagePointX = Math.max(
      0,
      Math.min(layout.imageWidth, untransformedX - layout.imageOffsetX),
    );
    const imagePointY = Math.max(
      0,
      Math.min(layout.imageHeight, untransformedY - layout.imageOffsetY),
    );

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
    this.setZoom(this.defaultZoom);
    this.pinchStartZoom = this.defaultZoom;
  }

  // ui-integration: 共用放大鏡保留商品頁的游標操作，並補上指標拖曳，讓長幅院藏影像可在觸控與滑鼠上檢視細節。
  protected startDrag(event: PointerEvent): void {
    if (!this.enabled()) return;
    const host = event.currentTarget as HTMLElement;
    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    host.setPointerCapture?.(event.pointerId);
    if (!this.dragging()) {
      this.dragging.set(true);
      this.draggingChange.emit(true);
    }
    if (this.activePointers.size >= 2) {
      this.pinchStartDistance = this.pointerDistance();
      this.pinchStartZoom = this.zoom();
      return;
    }

    this.move(event);
  }

  protected stopDrag(event?: PointerEvent): void {
    const host = event?.currentTarget as HTMLElement | undefined;
    if (host && event && host.hasPointerCapture?.(event.pointerId)) {
      host.releasePointerCapture(event.pointerId);
    }
    if (event) {
      this.activePointers.delete(event.pointerId);
    } else {
      this.activePointers.clear();
    }

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
    this.position.set({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    });
    this.active.set(true);
  }

  protected onLoad(event: Event): void {
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

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (this.panFrame !== null) cancelAnimationFrame(this.panFrame);
    this.activePointers.clear();
  }

  private setZoom(value: number): void {
    const next = Math.min(this.maxZoom, Math.max(this.minZoom, value));
    this.zoom.set(Math.round(next * 100) / 100);
  }

  private updatePosition(host: HTMLElement, clientX: number, clientY: number): void {
    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    this.position.set({ x, y });
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
    const image = this.observedImage;
    if (!image || typeof getComputedStyle === 'undefined') {
      return { scaleX: 1, scaleY: 1, translateX: 0, translateY: 0 };
    }
    const transform = getComputedStyle(image).transform;
    if (!transform || transform === 'none') {
      return { scaleX: 1, scaleY: 1, translateX: 0, translateY: 0 };
    }
    const values = transform.match(/matrix3d\(([^)]+)\)|matrix\(([^)]+)\)/);
    if (!values) return { scaleX: 1, scaleY: 1, translateX: 0, translateY: 0 };
    const numbers = (values[1] ?? values[2]).split(',').map(Number);
    if (values[1]) {
      return {
        scaleX: Math.abs(numbers[0]) || 1,
        scaleY: Math.abs(numbers[5]) || 1,
        translateX: numbers[12] || 0,
        translateY: numbers[13] || 0,
      };
    }
    return {
      scaleX: Math.abs(numbers[0]) || 1,
      scaleY: Math.abs(numbers[3]) || 1,
      translateX: numbers[4] || 0,
      translateY: numbers[5] || 0,
    };
  }

  private pointerDistance(): number | null {
    const pointers = [...this.activePointers.values()];
    if (pointers.length < 2) return null;

    const [first, second] = pointers;
    return Math.hypot(second.x - first.x, second.y - first.y);
  }

  private updateLayout(host = this.observedHost, image = this.observedImage): void {
    if (!host || !image?.naturalWidth || !image.naturalHeight) return;

    const { width: hostWidth, height: hostHeight } = host.getBoundingClientRect();
    if (!hostWidth || !hostHeight) return;

    const scale =
      this.fit() === 'contain'
        ? Math.min(hostWidth / image.naturalWidth, hostHeight / image.naturalHeight)
        : Math.max(hostWidth / image.naturalWidth, hostHeight / image.naturalHeight);
    const imageWidth = image.naturalWidth * scale;
    const imageHeight = image.naturalHeight * scale;
    const lens = host.querySelector<HTMLElement>('.magnifier-lens');
    const lensRect = lens?.getBoundingClientRect();

    // Keep the same centered object-fit geometry as the source image, including letterbox/crop.
    this.layout.set({
      hostWidth,
      hostHeight,
      imageWidth,
      imageHeight,
      imageOffsetX: (hostWidth - imageWidth) / 2,
      imageOffsetY: (hostHeight - imageHeight) / 2,
      lensWidth: lensRect?.width ?? 132,
      lensHeight: lensRect?.height ?? 132,
    });
  }
}
