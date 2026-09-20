import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { HomeApi } from '../../../api';
import type { Coupon, HeroSlide } from '../../../api/api.models';
import { PRODUCT_LIST_PATH } from '../../../shared/paths';
import { StoreLink } from '../../../shared/store-link';

/** 自動播放間隔（毫秒），僅本元件內部使用，非可由外部調整的行為 */
const AUTOPLAY_MS = 5200;

type StoreHeroSlide = HeroSlide & { coupon: Coupon | null };

const EDITORIAL_SLIDES: HeroSlide[] = [
  {
    slot: '',
    kicker: 'QMAH NOTE / 選物誌',
    title: '把紙上風景帶回書桌',
    desc: '從一張明信片開始，讓一次看見慢慢留在日常。',
  },
  {
    slot: '',
    kicker: 'QMAH SELECT / 日常收藏',
    title: '收藏不必等到特別的日子',
    desc: '挑一件有故事的選物，替今天留下一點餘裕。',
  },
  {
    slot: '',
    kicker: 'QMAH NOTE / 館藏靈感',
    title: '從一件小物開始認識館藏',
    desc: '在材質、紋樣與來源之間，找到屬於你的喜歡。',
  },
  {
    slot: '',
    kicker: 'QMAH NOTE / 收藏日常',
    title: '開一盞燈，讓故事留下來',
    desc: '把一段看見放在身邊，日常也能有自己的觀看方式。',
  },
  {
    slot: '',
    kicker: 'QMAH SELECT / 慢慢挑選',
    title: '把日常留給一件好物',
    desc: '不追著流行走，挑一件真正願意長久相處的物件。',
  },
  {
    slot: '',
    kicker: 'QMAH NOTE / 看見細節',
    title: '看見細節，也看見自己',
    desc: '一點色澤、一段紋樣，都值得被好好理解。',
  },
];

/** 首頁主視覺輪播：自動播放，並可點擊指示點跳至指定投影片 */
@Component({
  selector: 'app-hero-carousel',
  imports: [StoreLink],
  templateUrl: './hero-carousel.html',
  styleUrls: [
    './hero-carousel.scss',
  ],
})
export class HeroCarousel {
  private readonly homeApi = inject(HomeApi);

  /** 後端提供的輪播文案；有資料時永遠優先使用正式內容。 */
  private readonly apiSlides = toSignal(this.homeApi.getHeroSlides(), { initialValue: [] });
  /** 真實可領取優惠，僅用來在主視覺補充可驗證的優惠訊息。 */
  private readonly claimableCoupons = toSignal(this.homeApi.getClaimableCoupons(), { initialValue: [] });

  /**
   * ui-integration: 不修改 Hero API 契約；後端尚未提供主視覺時，才用專案內的品牌
   * 素材與真實可領優惠維持首頁入口的完整性。若兩個 API 都沒有資料，版位仍隱藏，
   * 不把空資料包裝成假促銷。
   */
  protected readonly slides = computed<StoreHeroSlide[]>(() => {
    const apiSlides = this.apiSlides();
    const baseSlides = apiSlides.length > 0 ? apiSlides.slice(0, 3) : EDITORIAL_SLIDES.slice(0, 3);
    const couponSlides = this.claimableCoupons().slice(0, 3).map((coupon) => ({
      slot: '',
      kicker: this.couponKicker(coupon),
      title: this.couponSlogan(coupon),
      desc: `${coupon.title}｜${coupon.cond}。`,
      coupon,
    }));
    const editorialSlides = EDITORIAL_SLIDES
      .filter((slide) => !baseSlides.some((baseSlide) => baseSlide.title === slide.title))
      .map((slide) => ({ ...slide, coupon: null }));

    return [
      ...baseSlides.map((slide) => ({ ...slide, coupon: null })),
      ...couponSlides,
      ...editorialSlides,
    ].slice(0, 6);
  });

  /** 本地生成的無文字素材只負責氛圍，重要文案與折價數字由 HTML 保持可讀、可更新。 */
  private readonly slideImages = [
    '/images/store/hero/museum-shop-still-life.png',
    '/images/store/hero/gift-wrapping.png',
    '/images/store/hero/museum-shop-shelf.png',
  ];

  /** 目前顯示的投影片索引 */
  protected activeSlide = signal(0);
  /** ui-integration: 首頁輪播保留自動播放，但提供明確暫停控制，避免動態內容搶走閱讀焦點。 */
  protected autoplayEnabled = signal(true);
  protected readonly productsPath = PRODUCT_LIST_PATH;
  /** 依目前投影片索引換算的輪播橫向位移量 */
  protected trackShift = computed(() => `translateX(-${this.activeSlide() * 100}%)`);

  protected slideImage(index: number): string {
    return this.slideImages[index % this.slideImages.length];
  }

  protected couponForSlide(index: number): Coupon | null {
    return this.slides()[index]?.coupon ?? null;
  }

  private couponKicker(coupon: Coupon): string {
    if (coupon.kind === 'percent') return 'MEMBER BENEFIT / 會員回饋';
    if (coupon.kind === 'freeship') return 'SHIPPING BENEFIT / 寄送回饋';
    return 'COLLECTOR BENEFIT / 藏家優惠';
  }

  private couponSlogan(coupon: Coupon): string {
    if (coupon.kind === 'percent') return '讓下一件收藏更剛好';
    if (coupon.kind === 'freeship') return '喜歡的選物，安心寄到家';
    return '把喜歡的文物帶回家';
  }

  constructor() {
    // 自動播放，元件銷毀時自動停止
    interval(AUTOPLAY_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        const count = this.slides().length;
        if (count > 0 && this.autoplayEnabled()) this.activeSlide.update((v) => (v + 1) % count);
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
