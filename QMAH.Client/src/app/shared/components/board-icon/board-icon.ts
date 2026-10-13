import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  LucideBookOpen, LucideCalendarDays, LucideCalendarHeart, LucideCircleHelp, LucideCompass, LucideGamepad2,
  LucideLandmark, LucideMessagesSquare, LucideNotebookPen, LucideShoppingBag, LucideTag,
} from '@lucide/angular';

/** 看板小圖示：十個看板各一個，不在表內的看板用通用標籤圖示。顏色沿用外層的 currentColor。 */
@Component({
  selector: 'app-board-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideBookOpen, LucideCalendarDays, LucideCalendarHeart, LucideCircleHelp, LucideCompass, LucideGamepad2, LucideLandmark, LucideMessagesSquare, LucideNotebookPen, LucideShoppingBag, LucideTag],
  host: { 'aria-hidden': 'true', style: 'display:inline-flex;flex:none;line-height:0' },
  template: `
    @switch (code()?.toUpperCase()) {
      @case ('CATALOG') { <svg lucideLandmark focusable="false"></svg> }
      @case ('DISCOVERY') { <svg lucideCompass focusable="false"></svg> }
      @case ('REVIEW') { <svg lucideNotebookPen focusable="false"></svg> }
      @case ('GUIDE') { <svg lucideBookOpen focusable="false"></svg> }
      @case ('EVENT') { <svg lucideCalendarHeart focusable="false"></svg> }
      @case ('EVENTS') { <svg lucideCalendarDays focusable="false"></svg> }
      @case ('STORE') { <svg lucideShoppingBag focusable="false"></svg> }
      @case ('GENERAL') { <svg lucideMessagesSquare focusable="false"></svg> }
      @case ('QUESTION') { <svg lucideCircleHelp focusable="false"></svg> }
      @case ('GAME') { <svg lucideGamepad2 focusable="false"></svg> }
      @default { <svg lucideTag focusable="false"></svg> }
    }
  `,
  styles: `svg { width: 1em; height: 1em; }`,
})
export class BoardIconComponent {
  readonly code = input<string | null | undefined>('');
}
