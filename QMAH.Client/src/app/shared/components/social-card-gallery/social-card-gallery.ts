import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';

/**
 * 貼文牆卡片的多圖預覽：手動切換，不自動輪播。
 * 左右箭頭一直顯示；也可用鍵盤左右鍵、觸控左右滑動、點下方圓點。點圖片本身開啟貼文。
 * 高度固定、圖片裁切填滿，不會把卡片撐高。
 */
@Component({
  selector: 'app-social-card-gallery',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideChevronLeft, LucideChevronRight],
  styleUrl: './social-card-gallery.scss',
  template: `
    <div class="gallery" tabindex="0" role="group" aria-roledescription="圖片輪播" [attr.aria-label]="'貼文圖片，共 ' + images().length + ' 張，可用左右鍵切換'"
         (keydown.arrowleft)="step(-1, $event)" (keydown.arrowright)="step(1, $event)" (pointerdown)="swipeStart($event)" (pointerup)="swipeEnd($event)" (pointercancel)="swipeFrom = null">
      <a class="gallery__link" [routerLink]="['/social/posts', postId()]" tabindex="-1" aria-hidden="true">
        <img class="gallery__img" [src]="current()" alt="" loading="lazy" draggable="false" />
      </a>
      @if (images().length > 1) {
        <button type="button" class="gallery__nav gallery__nav--prev" aria-label="上一張圖片" (click)="step(-1, $event)"><svg lucideChevronLeft aria-hidden="true" focusable="false"></svg></button>
        <button type="button" class="gallery__nav gallery__nav--next" aria-label="下一張圖片" (click)="step(1, $event)"><svg lucideChevronRight aria-hidden="true" focusable="false"></svg></button>
        <span class="gallery__count" aria-live="polite">{{ index() + 1 }} / {{ images().length }}</span>
        <span class="gallery__dots">
          @for (image of images(); track $index) {
            <button type="button" class="gallery__dot" [class.is-active]="$index === index()" [attr.aria-label]="'第 ' + ($index + 1) + ' 張圖片'" [attr.aria-current]="$index === index() ? 'true' : null" (click)="select($index, $event)"></button>
          }
        </span>
      }
    </div>
  `,
})
export class SocialCardGalleryComponent {
  readonly images = input.required<readonly string[]>();
  readonly postId = input.required<string>();
  protected readonly index = signal(0);
  protected readonly current = computed(() => this.images()[Math.min(this.index(), this.images().length - 1)] ?? '');
  protected swipeFrom: number | null = null;

  protected step(delta: number, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const count = this.images().length;
    if (count > 1) this.index.update(value => (value + delta + count) % count);
  }

  protected select(position: number, event: Event): void {
    event.stopPropagation();
    this.index.set(position);
  }

  protected swipeStart(event: PointerEvent): void {
    this.swipeFrom = event.pointerType === 'mouse' ? null : event.clientX;
  }

  protected swipeEnd(event: PointerEvent): void {
    if (this.swipeFrom === null) return;
    const dx = event.clientX - this.swipeFrom;
    this.swipeFrom = null;
    if (Math.abs(dx) > 40) this.step(dx < 0 ? 1 : -1);
  }
}
