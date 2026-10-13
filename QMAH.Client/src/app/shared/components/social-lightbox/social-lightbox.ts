import { ChangeDetectionStrategy, Component, HostListener, computed, input, model } from '@angular/core';
import { LucideChevronLeft, LucideChevronRight, LucideX } from '@lucide/angular';

export interface LightboxImage { url: string; alt: string }

/**
 * 圖片放大檢視：點貼文圖片開啟，左右切換（按鈕、方向鍵、手機左右滑），Esc、點背景或叉號關閉。
 * index 為 null 代表關閉。
 */
@Component({
  selector: 'app-social-lightbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideChevronLeft, LucideChevronRight, LucideX],
  styleUrl: './social-lightbox.scss',
  template: `
    @if (current(); as image) {
      <div class="lb" role="dialog" aria-modal="true" aria-label="圖片放大檢視" (click)="close()"
        (touchstart)="touchX = $event.touches[0].clientX" (touchend)="onSwipe($event)">
        <button type="button" class="lb__btn lb__close" aria-label="關閉" (click)="close(); $event.stopPropagation()"><svg lucideX aria-hidden="true" focusable="false"></svg></button>
        @if (images().length > 1) {
          <button type="button" class="lb__btn lb__nav lb__nav--prev" aria-label="上一張" (click)="step(-1); $event.stopPropagation()"><svg lucideChevronLeft aria-hidden="true" focusable="false"></svg></button>
          <button type="button" class="lb__btn lb__nav lb__nav--next" aria-label="下一張" (click)="step(1); $event.stopPropagation()"><svg lucideChevronRight aria-hidden="true" focusable="false"></svg></button>
        }
        <img class="lb__img" [src]="image.url" [alt]="image.alt" (click)="$event.stopPropagation()" />
        <p class="lb__count" (click)="$event.stopPropagation()">{{ (index()! + 1) }} / {{ images().length }}</p>
      </div>
    }
  `,
})
export class SocialLightboxComponent {
  readonly images = input<LightboxImage[]>([]);
  readonly index = model<number | null>(null);
  protected readonly current = computed(() => {
    const i = this.index();
    return i === null ? null : (this.images()[i] ?? null);
  });
  protected touchX = 0;

  protected close(): void {
    this.index.set(null);
  }

  protected step(delta: number): void {
    const i = this.index();
    const n = this.images().length;
    if (i === null || n === 0) return;
    this.index.set((i + delta + n) % n);
  }

  protected onSwipe(event: TouchEvent): void {
    const dx = event.changedTouches[0].clientX - this.touchX;
    if (Math.abs(dx) > 50) this.step(dx < 0 ? 1 : -1);
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(event: KeyboardEvent): void {
    if (this.index() === null) return;
    if (event.key === 'Escape') this.close();
    else if (event.key === 'ArrowLeft') this.step(-1);
    else if (event.key === 'ArrowRight') this.step(1);
  }
}
