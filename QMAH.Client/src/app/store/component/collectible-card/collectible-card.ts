import { Component, computed, input, signal } from '@angular/core';

type PostcardLayout = 'landscape' | 'portrait' | 'square' | 'rotated';

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
  /** 使用既有商品說明，僅節錄而不編造文物資料。 */
  description = input('');
  protected readonly excerpt = computed(() => {
    const text = this.description().replace(/\s+/g, ' ').trim();
    const characters = Array.from(text);
    return characters.length > 72 ? characters.slice(0, 72).join('') + '…' : text;
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

    // 超長直幅畫作轉成橫向印刷構圖，才不會在橫式明信片中只剩一條窄圖。
    if (aspectRatio < 0.65) return 'rotated';
    if (aspectRatio < 0.8) return 'portrait';
    if (aspectRatio > 1.25) return 'landscape';
    return 'square';
  });

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
