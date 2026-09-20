import { Component, OnDestroy, computed, input, output, signal } from '@angular/core';
import { LucideImage } from '@lucide/angular';

interface MagnifierLayout {
  hostWidth: number;
  hostHeight: number;
  imageWidth: number;
  imageHeight: number;
  imageOffsetX: number;
  imageOffsetY: number;
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
  loaded = output<{ width: number; height: number }>();
  draggingChange = output<boolean>();

  protected active = signal(false);
  protected dragging = signal(false);
  protected position = signal({ x: 50, y: 50 });
  private readonly zoom = 2.6;
  private readonly layout = signal<MagnifierLayout | null>(null);
  private observedHost: HTMLElement | null = null;
  private observedImage: HTMLImageElement | null = null;
  private resizeObserver: ResizeObserver | null = null;

  protected backgroundSize = computed(() => {
    const layout = this.layout();
    if (!layout) return '260cqw 260cqh';
    return `${layout.imageWidth * this.zoom}px ${layout.imageHeight * this.zoom}px`;
  });

  protected backgroundPosition = computed(() => {
    const layout = this.layout();
    const point = this.position();
    if (!layout) return '50% 50%';

    const imagePointX = Math.max(
      0,
      Math.min(layout.imageWidth, (point.x / 100) * layout.hostWidth - layout.imageOffsetX),
    );
    const imagePointY = Math.max(
      0,
      Math.min(layout.imageHeight, (point.y / 100) * layout.hostHeight - layout.imageOffsetY),
    );

    return `calc(50% - ${imagePointX * this.zoom}px) calc(50% - ${imagePointY * this.zoom}px)`;
  });

  protected move(event: PointerEvent): void {
    const host = event.currentTarget as HTMLElement;
    if (!this.resizeObserver) this.updateLayout(host);
    const rect = host.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
    this.position.set({ x, y });
    this.active.set(true);
  }

  // ui-integration: 共用放大鏡保留商品頁的游標操作，並補上指標拖曳，讓長幅院藏影像可在觸控與滑鼠上檢視細節。
  protected startDrag(event: PointerEvent): void {
    const host = event.currentTarget as HTMLElement;
    host.setPointerCapture?.(event.pointerId);
    if (!this.dragging()) {
      this.dragging.set(true);
      this.draggingChange.emit(true);
    }
    this.move(event);
  }

  protected stopDrag(event?: PointerEvent): void {
    const host = event?.currentTarget as HTMLElement | undefined;
    if (host && event && host.hasPointerCapture?.(event.pointerId)) {
      host.releasePointerCapture(event.pointerId);
    }
    if (this.dragging()) {
      this.dragging.set(false);
      this.draggingChange.emit(false);
    }
  }

  protected leave(): void {
    if (!this.dragging()) this.active.set(false);
  }

  protected moveWithKeyboard(event: KeyboardEvent): void {
    if (!this.persistentLens()) return;

    const step = event.shiftKey ? 10 : 4;
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
    this.loaded.emit({ width: image.naturalWidth, height: image.naturalHeight });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
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

    // Keep the same centered object-fit geometry as the source image, including letterbox/crop.
    this.layout.set({
      hostWidth,
      hostHeight,
      imageWidth,
      imageHeight,
      imageOffsetX: (hostWidth - imageWidth) / 2,
      imageOffsetY: (hostHeight - imageHeight) / 2,
    });
  }
}
