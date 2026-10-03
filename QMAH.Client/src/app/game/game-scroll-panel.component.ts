import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, input, signal, viewChild } from '@angular/core';

@Component({
  selector:'app-game-scroll-panel',
  changeDetection:ChangeDetectionStrategy.OnPush,
  template:`
    <div #viewport class="scroll-viewport" role="region" [attr.aria-label]="label()" tabindex="0" (scroll)="update()">
      <div #content class="scroll-content"><ng-content /></div>
    </div>
    @if (hasMore()) { <footer><button type="button" (click)="scrollFurther()">{{ cue() }} ↓</button></footer> }
  `,
  styleUrl:'./game-scroll-panel.component.scss'
})
export class GameScrollPanelComponent {
  readonly label = input('可捲動內容');
  readonly cue = input('往下查看更多');
  readonly hasMore = signal(false);
  private readonly viewport = viewChild.required<ElementRef<HTMLElement>>('viewport');
  private readonly content = viewChild.required<ElementRef<HTMLElement>>('content');
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const observer = new ResizeObserver(() => this.update());
      observer.observe(this.viewport().nativeElement);
      observer.observe(this.content().nativeElement);
      this.destroyRef.onDestroy(() => observer.disconnect());
      this.update();
    });
  }

  update(): void {
    const area = this.viewport().nativeElement;
    this.hasMore.set(area.scrollHeight - area.scrollTop - area.clientHeight > 4);
  }

  scrollFurther(): void {
    const area = this.viewport().nativeElement;
    area.focus({ preventScroll:true });
    area.scrollBy({ top:area.clientHeight * .8, behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
}
