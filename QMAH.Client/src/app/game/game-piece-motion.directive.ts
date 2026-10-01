import { Directive, ElementRef, afterEveryRender, inject, input } from '@angular/core';

@Directive({ selector: '[appGamePieceMotion]' })
export class GamePieceMotionDirective {
  readonly appGamePieceMotion = input.required<number>();
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private previousSlot: number | null = null;
  private previousRect: DOMRect | null = null;

  constructor() {
    afterEveryRender(() => {
      const slot = this.appGamePieceMotion();
      const changed = this.previousSlot !== null && slot !== this.previousSlot;
      if (!changed && this.element.getAnimations().some(animation => animation.playState === 'running')) return;
      if (changed) this.element.getAnimations().forEach(animation => animation.cancel());
      const rect = this.element.getBoundingClientRect();
      if (changed && this.previousRect && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.element.animate([
          { transform: `translate(${this.previousRect.x - rect.x}px, ${this.previousRect.y - rect.y}px)`, zIndex: '2' },
          { transform: 'translate(0, 0)', zIndex: '2' }
        ], { duration: 260, easing: 'cubic-bezier(.16, 1, .3, 1)' });
      }
      this.previousSlot = slot;
      this.previousRect = rect;
    });
  }
}
