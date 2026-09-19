import { Component, computed, input, signal } from '@angular/core';

type PostcardLayout = 'landscape' | 'portrait';

/**
 * 文物明信片主視覺。
 * 商品列表不使用此元件，避免清單產生 3D 動畫與額外互動；只有商品詳情頁
 * 需要讓使用者翻面查看基本資料時才載入，保留前台效能與原本列表閱讀節奏。
 * 這裡使用原生 CSS 3D，不引入 Three.js；平面明信片不需要 WebGL
 * 場景，避免把額外 runtime 與 GPU 負擔帶到只需要一張縮圖的頁面。
 */
@Component({
  selector: 'app-collectible-card',
  templateUrl: './collectible-card.html',
  styleUrl: './collectible-card.scss',
})
export class CollectibleCard {
  /** 文物／商品名稱 */
  name = input('');
  /** 商品分類，直接使用既有型錄欄位，不另外新增 API 契約。 */
  type = input('');
  /** 商品主圖；沒有圖片時仍顯示有品牌的佔位面，避免版面塌陷。 */
  image = input<string | null>(null);
  /** 基本尺寸資料，收藏卡背面只顯示一行摘要。 */
  dimensions = input('');
  /** 使用既有商品說明，不另行編造文物資料。 */
  description = input('');
  /** 書畫需完整保留；其他藏品可安全滿版裁切，避免新增圖片版型契約。 */
  protected readonly preserveArtwork = computed(() => /書畫|繪畫|書法|畫冊|冊頁/u.test(this.type()));
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

  protected readonly flipped = signal(false);
  /**
   * 明信片外框與影像版型都依實際自然尺寸切換。
   * 這樣不需要預先產生多套圖片，也不會把長幅、方形與直幅文物硬塞進同一比例。
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
  /** 方向標示與外框共用同一個自然尺寸判斷，避免文字與實際版型不一致。 */
  protected readonly orientationLabel = computed(() =>
    this.postcardLayout() === 'landscape' ? '橫式' : '直式',
  );

  protected toggle(): void {
    this.flipped.update((value) => !value);
  }

  protected handleImageLoad(event: Event): void {
    const image = event.currentTarget as HTMLImageElement | null;
    if (!image?.naturalWidth || !image.naturalHeight) return;

    // 使用輸入值比對，避免瀏覽器把相對 URL 解析成絕對 URL 後讓版型一直停在預設值。
    this.loadedImageSource.set(this.image());
    this.imageAspectRatio.set(image.naturalWidth / image.naturalHeight);
  }

}
