import { ChangeDetectionStrategy, Component, DestroyRef, computed, OnInit, inject, input, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideBookmark, LucideCalendarDays, LucideChevronDown, LucideLayoutGrid, LucideMegaphone } from '@lucide/angular';

import { BoardIconComponent } from '../board-icon/board-icon';
import { SocialBoardsStore } from '../../../features/social/social-boards';
import { boardLabel, groupBoards } from '../../../features/social/social-labels';

/**
 * 社群三大頁面（貼文牆、站方公告、社群活動）共用的左側導覽與版型：
 * 最上面是「歷史公告」「社群活動」，下面是看板分類。內容放在 <ng-content>。
 *
 * - 貼文牆：inline 模式，點看板只發出 boardSelect 事件，不換頁（activeBoard 為目前看板，'' 代表全部）。
 * - 公告、活動：點看板會回到貼文牆並帶上 ?board=（activeBoard 傳 null，不標示任何看板）。
 * - 看板清單來自 SocialBoardsStore（快取），換頁時導覽不會閃爍或只剩一個分類。
 */
@Component({
  selector: 'app-social-shell',
  imports: [BoardIconComponent, RouterLink, RouterLinkActive, LucideBookmark, LucideCalendarDays, LucideChevronDown, LucideLayoutGrid, LucideMegaphone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './social-shell.scss',
  template: `
    <div class="shell">
      <nav class="shell__nav" aria-label="社群導覽">
        <!-- 所有導覽項目同一種樣式（圖示＋文字，選取時左側色條與同色淡底）；分組標題前的色條就是該組的顏色。 -->
        <div class="shell__group shell__group--site">
          <p class="shell__group-title">社群</p>
          <ul class="shell__list">
            <li><a class="shell__item" routerLink="/social/announcements" routerLinkActive="is-active" ariaCurrentWhenActive="page"><svg lucideMegaphone aria-hidden="true" focusable="false"></svg>歷史公告</a></li>
            <li><a class="shell__item" routerLink="/social/events" routerLinkActive="is-active" ariaCurrentWhenActive="page"><svg lucideCalendarDays aria-hidden="true" focusable="false"></svg>社群活動</a></li>
          </ul>
        </div>
        <div class="shell__group shell__group--site shell__group--divided" [class.shell__group--boards]="inline()">
          <p class="shell__group-title">看板</p>
          <ul class="shell__list">
            <li>
              @if (inline()) {
                <button type="button" class="shell__item" [class.is-active]="activeBoard() === ''" [attr.aria-current]="activeBoard() === '' ? 'true' : null" (click)="boardSelect.emit('')"><svg lucideLayoutGrid aria-hidden="true" focusable="false"></svg>全部貼文</button>
              } @else {
                <a class="shell__item" routerLink="/social/posts"><svg lucideLayoutGrid aria-hidden="true" focusable="false"></svg>全部貼文</a>
              }
            </li>
            <li>
              @if (inline()) {
                <button type="button" class="shell__item" [class.is-active]="activeBoard() === '@bookmarks'" [attr.aria-current]="activeBoard() === '@bookmarks' ? 'true' : null" (click)="boardSelect.emit('@bookmarks')"><svg lucideBookmark aria-hidden="true" focusable="false"></svg>我的收藏</button>
              } @else {
                <a class="shell__item" routerLink="/social/posts" [queryParams]="{ board: '@bookmarks' }"><svg lucideBookmark aria-hidden="true" focusable="false"></svg>我的收藏</a>
              }
            </li>
          </ul>
        </div>
        @if (inline()) {
          <label class="shell__mobile-picker">
            <span class="sr-only">貼文分類</span>
            <select [value]="activeBoard() ?? ''" (change)="boardSelect.emit($any($event.target).value)">
              <option value="">全部貼文</option>
              <option value="@bookmarks">我的收藏</option>
              @for (group of groups(); track group.key) {
                <optgroup [label]="group.label">
                  @for (board of group.boards; track board) {
                    <option [value]="board">{{ label(board) }}</option>
                  }
                </optgroup>
              }
            </select>
            <svg lucideChevronDown aria-hidden="true" focusable="false"></svg>
          </label>
        }
        @for (group of groups(); track group.key) {
          <div class="shell__group" [class.shell__group--boards]="inline()" [attr.data-board]="group.boards[0]">
            <p class="shell__group-title">{{ group.label }}</p>
            <ul class="shell__list">
              @for (board of group.boards; track board) {
                @if (inline()) {
                  <li><button type="button" class="shell__item" [class.is-active]="activeBoard() === board" [attr.aria-current]="activeBoard() === board ? 'true' : null" (click)="boardSelect.emit(board)"><app-board-icon [code]="board" />{{ label(board) }}</button></li>
                } @else {
                  <li><a class="shell__item" routerLink="/social/posts" [queryParams]="{ board }"><app-board-icon [code]="board" />{{ label(board) }}</a></li>
                }
              }
            </ul>
          </div>
        }
      </nav>
      <div class="shell__main">
        <ng-content />
      </div>
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

  protected readonly groups = computed(() => groupBoards(this.store.boards()));

  ngOnInit(): void {
    // 清單立即來自快取，這裡只是在背景更新
    this.store.load().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => undefined });
  }
}
