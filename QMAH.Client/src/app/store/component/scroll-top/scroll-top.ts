import { Component, DestroyRef, inject, signal } from '@angular/core';
import { LucideArrowUp } from '@lucide/angular';

/** 離場動畫的時間（毫秒），需與 scroll-top.scss 的 scroll-top-out 動畫時間一致 */
const LEAVE_MS = 200;

/**
 * 回到頁面頂端按鈕：頁面向下捲動後，顯示向上的箭頭，點擊後平順捲回頂端。
 * 出現時淡入並上移，消失時淡出並下移。已在頂端、尚未捲動，或頁面沒有捲軸（捲動位置永遠是 0）時不顯示。
 * 使用者設定減少動態時直接跳到頂端，也不播放出現與消失的動畫。
 *
 * 位置：按鈕是 position: sticky，須放在直向 flex 容器（例如頁面主體）的最後一個子元素；
 * 捲動時固定在視窗下緣，水平位置靠在該容器的右緣，捲到容器底部時停在容器的右下角。
 */
@Component({
  selector: 'app-scroll-top',
  imports: [LucideArrowUp],
  templateUrl: './scroll-top.html',
  styleUrl: './scroll-top.scss',
})
export class ScrollTop {
  /** 按鈕是否在畫面上（淡出期間仍然在） */
  protected readonly shown = signal(false);
  /** 按鈕正在淡出：套用離場動畫，結束後才真正移除 */
  protected readonly leaving = signal(false);
  private leaveTimer: ReturnType<typeof setTimeout> | null = null;
  /** 按鈕的無障礙名稱 */
  protected readonly label = '回到頁面頂端';

  constructor() {
    const update = () => this.setVisible(window.scrollY > 0);
    update();
    window.addEventListener('scroll', update, { passive: true });
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('scroll', update);
      this.clearLeaveTimer();
    });
  }

  /** 依頁面是否已捲動顯示或淡出按鈕；淡出途中又捲動時取消淡出 */
  private setVisible(visible: boolean): void {
    if (visible) {
      this.clearLeaveTimer();
      this.leaving.set(false);
      this.shown.set(true);
    } else if (this.shown() && !this.leaving()) {
      this.leaving.set(true);
      this.leaveTimer = setTimeout(() => {
        this.leaveTimer = null;
        this.shown.set(false);
        this.leaving.set(false);
      }, LEAVE_MS);
    }
  }

  private clearLeaveTimer(): void {
    if (this.leaveTimer !== null) clearTimeout(this.leaveTimer);
    this.leaveTimer = null;
  }

  /** 捲回頁面頂端 */
  protected scrollToTop(): void {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }
}
