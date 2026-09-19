import { Component, computed, input, output, signal } from '@angular/core';

/** 商品詳情共用的局部放大鏡；不會放大整個商品欄位，也不建立第二份圖片資產。 */
@Component({
  selector: 'app-image-magnifier',
  templateUrl: './image-magnifier.html',
  styleUrl: './image-magnifier.scss',
})
export class ImageMagnifier {
  image = input<string | null>(null);
  alt = input('');
  fit = input<'cover' | 'contain'>('cover');
  loaded = output<{ width: number; height: number }>();

  protected active = signal(false);
  protected position = signal({ x: 50, y: 50 });
  protected positionText = computed(() => {
    const point = this.position();
    return `${point.x}% ${point.y}%`;
  });

  protected move(event: PointerEvent): void {
    const host = event.currentTarget as HTMLElement;
    const rect = host.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
    this.position.set({ x, y });
    this.active.set(true);
  }

  protected onLoad(event: Event): void {
    const image = event.currentTarget as HTMLImageElement;
    this.loaded.emit({ width: image.naturalWidth, height: image.naturalHeight });
  }
}
