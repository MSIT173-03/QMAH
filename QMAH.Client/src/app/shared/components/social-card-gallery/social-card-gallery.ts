import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';

/** 貼文牆卡片的多圖預覽：手動切換（左右鈕與圓點），不自動輪播；高度固定，圖片裁切填滿。 */
@Component({
  selector: 'app-social-card-gallery',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideChevronLeft, LucideChevronRight],
  styleUrl: './social-card-gallery.scss',
  template: `
    <div class="gallery" role="group" aria-roledescription="圖片輪播" [attr.aria-label]="'貼文圖片，共 ' + images().length + ' 張'">
      <img class="gallery__img" [src]="current()" alt="" loading="lazy" />
      @if (images().length > 1) {
        <button type="button" class="gallery__nav gallery__nav--prev" aria-label="上一張圖片" (click)="step(-1)"><svg lucideChevronLeft aria-hidden="true" focusable="false"></svg></button>
        <button type="button" class="gallery__nav gallery__nav--next" aria-label="下一張圖片" (click)="step(1)"><svg lucideChevronRight aria-hidden="true" focusable="false"></svg></button>
        <span class="gallery__count" aria-live="polite">{{ index() + 1 }} / {{ images().length }}</span>
        <span class="gallery__dots">
          @for (image of images(); track $index) {
            <button type="button" class="gallery__dot" [class.is-active]="$index === index()" [attr.aria-label]="'第 ' + ($index + 1) + ' 張圖片'" [attr.aria-current]="$index === index() ? 'true' : null" (click)="index.set($index)"></button>
          }
        </span>
      }
    </div>
  `,
})
export class SocialCardGalleryComponent {
  readonly images = input.required<readonly string[]>();
  protected readonly index = signal(0);
  protected readonly current = computed(() => this.images()[Math.min(this.index(), this.images().length - 1)] ?? '');

  protected step(delta: number): void {
    const count = this.images().length;
    this.index.update(value => (value + delta + count) % count);
  }
}
