import { Component, computed, input, signal } from '@angular/core';
import { ImageMagnifier } from '../image-magnifier/image-magnifier';
import { LucideImage } from '@lucide/angular';

type PostcardLayout = 'landscape' | 'portrait';

/**
 * 文物明信片主視覺。
 * 商品列表不使用此元件，避免清單產生 3D 動畫與額外互動；只有商品詳情頁
 * 需要讓使用者翻面查看基本資料時才載入。
 * 翻面使用原生 CSS 3D，不引入 Three.js／WebGL：平面明信片不需要 3D 場景，
 * 也就不必為一張圖多帶 runtime 與 GPU 負擔。
 */
@Component({
  selector: 'app-collectible-card',
  imports: [ImageMagnifier, LucideImage],
  templateUrl: './collectible-card.html',
  styleUrl: './collectible-card.scss',
})
export class CollectibleCard {
  /** 文物／商品名稱 */
  name = input('');
  /** 商品分類 */
  type = input('');
  /** 商品主圖；沒有圖片時仍顯示有品牌的佔位面，避免版面塌陷。 */
  image = input<string | null>(null);
  /** 基本尺寸資料，收藏卡背面只顯示一行摘要。 */
  dimensions = input('');
  /** 商品說明 */
  description = input('');
  /** 外層旋轉觀看方向時的角度，轉交給放大鏡換算游標座標。 */
  rotation = input(0);

  /** 背面說明依標點切成的片段，標點後提供優先換行點 */
  protected readonly descriptionSegments = computed(() => {
    // 明信片印刷文案不在末尾補停頓符號；只去除最後一個句號，句中標點完整保留。
    const text = this.description().trim().replace(/[。.]$/u, '');
    const segments: string[] = text ? [''] : [];

    // 逐字累積並在標點後切段，連標點開頭或沒有標點的文字也不會遺失。
    for (const character of text) {
      segments[segments.length - 1] = `${segments[segments.length - 1] ?? ''}${character}`;
      if (/[，。；！？、：,.!?;:]/u.test(character)) segments.push('');
    }

    return segments.filter(Boolean);
  });

  /** 是否已翻到背面 */
  protected readonly flipped = signal(false);
  /**
   * 明信片外框與影像版型都依圖片實際的自然尺寸切換，
   * 長幅、方形與直幅文物不必硬塞進同一比例，也不需要預先產生多套圖片。
   */
  private readonly loadedImageSource = signal<string | null>(null);
  private readonly imageAspectRatio = signal<number | null>(null);
  protected readonly postcardLayout = computed<PostcardLayout>(() => {
    const imageSource = this.image();
    const loadedSource = this.loadedImageSource();
    const aspectRatio = this.imageAspectRatio();

    if (!imageSource || loadedSource !== imageSource || !aspectRatio) {
      return 'landscape';
    }

    // 來源影像已是正確方向，這裡只決定明信片尺寸，不擅自旋轉圖片或文字。
    return aspectRatio >= 1 ? 'landscape' : 'portrait';
  });

  protected toggle(): void {
    this.flipped.update((value) => !value);
  }

  protected handleImageLoad(size: { width: number; height: number }): void {
    if (!size.width || !size.height) return;

    // 使用輸入值比對，避免瀏覽器把相對 URL 解析成絕對 URL 後讓版型一直停在預設值。
    this.loadedImageSource.set(this.image());
    this.imageAspectRatio.set(size.width / size.height);
  }
}
