import { Component, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { PRODUCT_LIST_PATH } from '../../../shared/paths';
import { StoreLink } from '../../../shared/store-link';
import { QmahIconComponent } from '../../../../shared/components/qmah-icon/qmah-icon';

/** 自動播放間隔（毫秒），僅本元件內部使用，非可由外部調整的行為 */
const AUTOPLAY_MS = 5200;

/** 主視覺輪播投影片 */
interface HeroSlide {
  kicker: string;
  title: string;
  desc: string;
}

/** 輪播的投影片（本地的編輯文案，後端沒有主視覺版位的 API） */
const HERO_SLIDES: HeroSlide[] = [
  {
    kicker: '清明選物誌',
    title: '把紙上風景帶回書桌',
    desc: '從一張明信片開始，讓一次看見慢慢留在日常。',
  },
  {
    kicker: '清明選物・日常收藏',
    title: '收藏不必等到特別的日子',
    desc: '挑一件有故事的選物，替今天留下一點餘裕。',
  },
  {
    kicker: '清明選物誌・館藏靈感',
    title: '從一件小物開始認識館藏',
    desc: '在材質、紋樣與來源之間，找到屬於你的喜歡。',
  },
  {
    kicker: '清明選物誌・收藏日常',
    title: '開一盞燈，讓故事留下來',
    desc: '把一段看見放在身邊，日常也能有自己的觀看方式。',
  },
  {
    kicker: '清明選物・慢慢挑選',
    title: '把日常留給一件好物',
    desc: '不追著流行走，挑一件真正願意長久相處的物件。',
  },
  {
    kicker: '清明選物誌・看見細節',
    title: '看見細節，也看見自己',
    desc: '一點色澤、一段紋樣，都值得被好好理解。',
  },
];

/** 首頁主視覺輪播：自動播放，並可點擊指示點跳至指定投影片 */
@Component({
  selector: 'app-hero-carousel',
  imports: [StoreLink, QmahIconComponent],
  templateUrl: './hero-carousel.html',
  styleUrl: './hero-carousel.scss',
})
export class HeroCarousel {
  /** 輪播的投影片 */
  protected readonly slides = HERO_SLIDES;

  /** 本地的無文字素材只負責氛圍，文案由模板顯示，保持可讀、可更新 */
  private readonly slideImages = [
    '/images/store/hero/museum-shop-still-life.png',
    '/images/store/hero/gift-wrapping.png',
    '/images/store/hero/museum-shop-shelf.png',
  ];

  /** 目前顯示的投影片索引 */
  protected activeSlide = signal(0);
  /** 是否自動播放；使用者可暫停，避免動態內容搶走閱讀焦點 */
  protected autoplayEnabled = signal(true);
  protected readonly productsPath = PRODUCT_LIST_PATH;
  /** 依目前投影片索引換算的輪播橫向位移量 */
  protected trackShift = computed(() => `translateX(-${this.activeSlide() * 100}%)`);

  protected slideImage(index: number): string {
    return this.slideImages[index % this.slideImages.length];
  }

  constructor() {
    // 自動播放，元件銷毀時自動停止
    interval(AUTOPLAY_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (this.autoplayEnabled()) this.activeSlide.update((v) => (v + 1) % this.slides.length);
      });
  }

  /** 切換輪播至指定投影片索引 */
  protected goToSlide(index: number): void {
    this.activeSlide.set(index);
  }

  protected toggleAutoplay(): void {
    this.autoplayEnabled.update((enabled) => !enabled);
  }
}
