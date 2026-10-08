import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, input, output } from '@angular/core';

import { GameAnswer } from './game.models';
import { QmahIconComponent, QmahIconName } from '../shared/components/qmah-icon/qmah-icon';

@Component({
  selector: 'app-game-answer-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [QmahIconComponent],
  templateUrl: './game-answer-card.component.html',
  styleUrl: './game-answer-card.component.scss'
})
export class GameAnswerCardComponent implements AfterViewInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly answer = input.required<GameAnswer>();
  readonly groupLabel = input.required<string>();
  readonly icon = input.required<QmahIconName>();
  readonly anonymous = input(false);
  readonly mobile = input(false);
  readonly order = input(0);
  readonly position = input(1);
  readonly count = input(1);
  readonly ownerColor = input('#376d62');
  readonly tilt = input('0deg');
  readonly selected = output<GameAnswer>();

  // 卡片高度固定；內文依實際可用高度決定顯示幾行，超出的以刪節號收尾，避免最後一行被攔腰切掉。
  ngAfterViewInit(): void {
    const text = this.host.nativeElement.querySelector<HTMLElement>('.answer-text');
    if (!text || typeof ResizeObserver === 'undefined') return;
    const fit = () => {
      const card = text.parentElement;
      const lineHeight = parseFloat(getComputedStyle(text).lineHeight);
      if (!card || !(lineHeight > 0)) return;
      const cardStyle = getComputedStyle(card);
      const textStyle = getComputedStyle(text);
      // 卡片內扣掉標題列、內距與下邊距後剩下的高度，只放得下整數行，其餘以刪節號收尾。
      const available = card.clientHeight - text.offsetTop - parseFloat(cardStyle.paddingBottom) - parseFloat(textStyle.marginBottom);
      const lines = Math.max(1, Math.floor(available / lineHeight));
      text.style.setProperty('-webkit-line-clamp', String(lines));
    };
    let frame = 0;
    const observer = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(fit); });
    observer.observe(text);
    if (text.parentElement) observer.observe(text.parentElement);
    this.destroyRef.onDestroy(() => { cancelAnimationFrame(frame); observer.disconnect(); });
    fit();
  }
}
