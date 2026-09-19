import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { HomeApi } from '../../../api';

/** 自動播放間隔（毫秒），僅本元件內部使用，非可由外部調整的行為 */
const AUTOPLAY_MS = 5200;

/** 首頁主視覺輪播：自動播放，並可點擊指示點跳至指定投影片 */
@Component({
  selector: 'app-hero-carousel',
  imports: [],
  templateUrl: './hero-carousel.html',
  styleUrls: [
    './hero-carousel.scss',
  ],
})
export class HeroCarousel {
  /** 輪播投影片資料 */
  protected readonly slides = toSignal(inject(HomeApi).getHeroSlides(), { initialValue: [] });

  /** 目前顯示的投影片索引 */
  protected activeSlide = signal(0);
  /** 依目前投影片索引換算的輪播橫向位移量 */
  protected trackShift = computed(() => `translateX(-${this.activeSlide() * 100}%)`);

  constructor() {
    // 自動播放，元件銷毀時自動停止
    interval(AUTOPLAY_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        const count = this.slides().length;
        if (count > 0) this.activeSlide.update((v) => (v + 1) % count);
      });
  }

  /** 切換輪播至指定投影片索引 */
  protected goToSlide(index: number): void {
    this.activeSlide.set(index);
  }
}
