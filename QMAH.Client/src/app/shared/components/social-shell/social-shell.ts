import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideCalendarDays, LucideChevronRight, LucideMegaphone } from '@lucide/angular';

import { SocialBoardsStore } from '../../../features/social/social-boards';
import { boardLabel } from '../../../features/social/social-labels';

/**
 * 社群三大頁面（貼文牆、站方公告、社群活動）共用的左側導覽與版型：
 * 最上面是「站方公告」「社群活動」，下面是看板分類。內容放在 <ng-content>。
 *
 * - 貼文牆：inline 模式，點看板只發出 boardSelect 事件，不換頁（activeBoard 為目前看板，'' 代表全部）。
 * - 公告、活動：點看板會回到貼文牆並帶上 ?board=（activeBoard 傳 null，不標示任何看板）。
 * - 看板清單來自 SocialBoardsStore（快取），換頁時導覽不會閃爍或只剩一個分類。
 */
@Component({
  selector: 'app-social-shell',
  imports: [RouterLink, RouterLinkActive, LucideCalendarDays, LucideChevronRight, LucideMegaphone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './social-shell.scss',
  template: `
    <div class="shell">
      <nav class="shell__nav" aria-label="社群導覽">
        <p class="shell__title">社群</p>
        <ul class="shell__list">
          <li><a class="shell__item shell__item--link" routerLink="/social/announcements" routerLinkActive="is-active" ariaCurrentWhenActive="page"><svg lucideMegaphone aria-hidden="true" focusable="false"></svg>站方公告<svg class="shell__go" lucideChevronRight aria-hidden="true" focusable="false"></svg></a></li>
          <li><a class="shell__item shell__item--link" routerLink="/social/events" routerLinkActive="is-active" ariaCurrentWhenActive="page"><svg lucideCalendarDays aria-hidden="true" focusable="false"></svg>社群活動<svg class="shell__go" lucideChevronRight aria-hidden="true" focusable="false"></svg></a></li>
        </ul>
        <p class="shell__title shell__title--gap">看板</p>
        <ul class="shell__list">
          @if (inline()) {
            <li><button type="button" class="shell__item" [class.is-active]="activeBoard() === ''" [attr.aria-current]="activeBoard() === '' ? 'true' : null" (click)="boardSelect.emit('')">全部貼文</button></li>
            @for (board of list(); track board) {
              <li><button type="button" class="shell__item" [class.is-active]="activeBoard() === board" [attr.aria-current]="activeBoard() === board ? 'true' : null" (click)="boardSelect.emit(board)">{{ label(board) }}</button></li>
            }
          } @else {
            <li><a class="shell__item" routerLink="/social/posts">全部貼文</a></li>
            @for (board of list(); track board) {
              <li><a class="shell__item" routerLink="/social/posts" [queryParams]="{ board }">{{ label(board) }}</a></li>
            }
          }
        </ul>
      </nav>
      <div class="shell__main"><ng-content /></div>
    </div>
  `,
})
export class SocialShellComponent implements OnInit {
  private readonly store = inject(SocialBoardsStore);
  private readonly destroyRef = inject(DestroyRef);

  /** 目前看板：'' 為全部；null 表示不在貼文牆，不標示 */
  readonly activeBoard = input<string | null>(null);
  readonly inline = input(false);
  readonly boardSelect = output<string>();

  protected readonly label = boardLabel;

  protected readonly list = this.store.boards;

  ngOnInit(): void {
    // 清單立即來自快取，這裡只是在背景更新
    this.store.load().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => undefined });
  }
}
