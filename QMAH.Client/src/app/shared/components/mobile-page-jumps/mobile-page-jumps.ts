import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, inject, input } from '@angular/core';

export interface MobilePageJump { targetId: string; label: string; }

@Component({
  selector: 'app-mobile-page-jumps',
  template: `
    <label class="page-jumps">
      <span>快速前往</span>
      <select aria-label="快速前往頁面區段" (change)="jump($event)">
        <option value="">選擇區段…</option>
        @for (item of items(); track item.targetId) {
          <option [value]="item.targetId">{{ item.label }}</option>
        }
      </select>
    </label>
  `,
  styleUrl: './mobile-page-jumps.scss',
})
export class MobilePageJumps {
  readonly items = input.required<readonly MobilePageJump[]>();
  private readonly document = inject(DOCUMENT);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  jump(event: Event): void {
    const select = event.target as HTMLSelectElement;
    if (!this.items().some(item => item.targetId === select.value)) return;
    const target = this.document.getElementById(select.value);
    // Some existing store components use display: contents; scroll to their visible section.
    let region: Element | null | undefined = target;
    while (region && !region.getClientRects().length) region = region.firstElementChild;
    if (region) {
      const view = this.document.defaultView;
      const reduce = view?.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const bar = this.element.nativeElement;
      const inset = parseFloat(view?.getComputedStyle(bar).top ?? '') || 0;
      const offset = inset + bar.getBoundingClientRect().height + 8;
      const top = region.getBoundingClientRect().top + (view?.scrollY ?? 0) - offset;
      view?.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' });
    }
    select.value = '';
  }
}
