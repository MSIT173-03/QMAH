import { Component, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { CART_PATH, PRODUCT_LIST_PATH } from '../../../shared/paths';
import { StoreLink } from '../../../shared/store-link';
import { QmahIconComponent } from '../../../../shared/components/qmah-icon/qmah-icon';

/** 自動播放間隔（毫秒），僅本元件內部使用 */
const AUTOPLAY_MS = 6000;
/** 手機上水平滑動超過這個距離（像素）才算切換，避免誤觸 */
const SWIPE_MIN_PX = 40;

/** 主視覺輪播投影片 */
interface HeroSlide {
  kicker: string;
  title: string;
  desc: string;
  cta: string;
  link: string;
  /** 投影片背景圖（位於 public/images/store/hero/） */
  image: string;
}

/**
 * 輪播的投影片：只放商城現有的活動與規則（後端沒有主視覺版位的 API，這裡是前台設定）。
 * 折扣、免運門檻與打折商品要與後端資料一致；活動結束或商品變動時請同步更新。
 */
const HERO_SLIDES: HeroSlide[] = [
  {
    kicker: '歲末送禮季',
    title: '年底送禮\n12 月結帳享 9 折',
    desc: '符合條件的折扣券可折抵 10%，最低消費 NT$2,000。\n送人或自己留著，都是一份好的收藏理由。',
    cta: '看全部商品',
    link: PRODUCT_LIST_PATH,
    image: '/images/store/hero/gift-box-ribbon.jpg',
  },
  {
    kicker: '分類專題・陶瓷',
    title: '陶瓷全館 9 折\n一釉一器，慢慢挑',
    desc: '陶瓷類商品已直接打折，加入購物車時就是折後價，\n不需要另外輸入代碼。',
    cta: '逛陶瓷',
    link: `${PRODUCT_LIST_PATH}?cat=${encodeURIComponent('陶瓷')}`,
    image: '/images/store/hero/ceramic-blue-white-bowl-cma.jpg',
  },
  {
    kicker: '精選特價・錢幣',
    title: '錢幣精選 8 折\n第一次收藏從這裡開始',
    desc: '挑出十件錢幣商品直接打折。\n圓的、方孔的、刻著字的，每一枚都有自己的故事。',
    cta: '看錢幣特價',
    link: `${PRODUCT_LIST_PATH}?cat=${encodeURIComponent('錢幣')}`,
    image: '/images/store/hero/chinese-cash-coins-cma.jpg',
  },
  {
    kicker: '購物小提醒',
    title: '滿 NT$1,500\n享免運',
    desc: '商品金額達門檻，結帳時自動免除運費。\n購物車會告訴你還差多少，不用自己算。',
    cta: '前往購物車',
    link: CART_PATH,
    image: '/images/store/hero/shipping-kraft-box.jpg',
  },
  {
    kicker: '從時代出發',
    title: '宋、明、清，\n一路看到日本江戶',
    desc: '依時代與器類篩選：青銅器、陶瓷、玉器、繪畫，\n想找哪個時代的紋樣，從分類入口就能開始。',
    cta: '開始挑選',
    link: PRODUCT_LIST_PATH,
    image: '/images/store/hero/landscape-handscroll-cma.jpg',
  },
];

/** 首頁主視覺輪播：自動播放（滑鼠停留時暫停）、可用箭頭、指示點、鍵盤左右鍵與手機滑動切換 */
@Component({
  selector: 'app-hero-carousel',
  imports: [StoreLink, QmahIconComponent],
  templateUrl: './hero-carousel.html',
  styleUrl: './hero-carousel.scss',
})
export class HeroCarousel {
  /** 輪播的投影片 */
  protected readonly slides = HERO_SLIDES;

  /** 目前顯示的投影片索引 */
  protected activeSlide = signal(0);
  /** 是否自動播放；使用者可暫停，避免動態內容搶走閱讀焦點 */
  protected autoplayEnabled = signal(true);
  /** 滑鼠停在輪播上時暫時不自動切換，讓人有時間讀完文案 */
  private readonly hovered = signal(false);
  /** 依目前投影片索引換算的輪播橫向位移量 */
  protected trackShift = computed(() => `translateX(-${this.activeSlide() * 100}%)`);
  private touchStartX: number | null = null;

  constructor() {
    // 自動播放，元件銷毀時自動停止
    interval(AUTOPLAY_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (this.autoplayEnabled() && !this.hovered()) this.step(1);
      });
  }

  /** 切換輪播至指定投影片索引 */
  protected goToSlide(index: number): void {
    this.activeSlide.set(index);
  }

  /** 上一張／下一張（循環） */
  protected step(delta: number): void {
    this.activeSlide.update((v) => (v + delta + this.slides.length) % this.slides.length);
  }

  protected toggleAutoplay(): void {
    this.autoplayEnabled.update((enabled) => !enabled);
  }

  protected setHovered(value: boolean): void {
    this.hovered.set(value);
  }

  protected onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.touches[0]?.clientX ?? null;
  }

  /** 水平滑動超過門檻才切換；垂直捲動不會誤切 */
  protected onTouchEnd(event: TouchEvent): void {
    if (this.touchStartX === null) return;
    const endX = event.changedTouches[0]?.clientX ?? this.touchStartX;
    const delta = endX - this.touchStartX;
    this.touchStartX = null;
    if (Math.abs(delta) >= SWIPE_MIN_PX) this.step(delta < 0 ? 1 : -1);
  }
}
