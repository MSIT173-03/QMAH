import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { MeApiService } from '../../../core/services/me-api';
import { demoPost, isDemoAdmin } from '../social-demo';
import { UserAvatarComponent } from '../../../shared/components/user-avatar/user-avatar';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { CreateSocialPostRequest, EventListItem, SocialApiService, SocialMedia, SocialPostListItem } from '../../../core/services/social-api';
import { SocialMediaLayout, SocialMediaManagerComponent } from '../../../shared/components/social-media-manager/social-media-manager';
import { ReportModalComponent } from '../../../shared/components/report-modal/report-modal';
import { SocialPostContentComponent } from '../../../shared/components/social-post-content/social-post-content';
import { SOCIAL_COLORS, stripSocialMarkup } from '../../../shared/social-markup';
import { boardLabel } from '../social-labels';
import { SocialShellComponent } from '../../../shared/components/social-shell/social-shell';
import { SocialBoardsStore } from '../social-boards';
import { SocialSpotlightComponent } from '../../../shared/components/social-spotlight/social-spotlight';
import {
  LucideExternalLink,
  LucideFlag,
  LucideMaximize2,
  LucideMinimize2,
  LucideImage,
  LucideMessageCircle,
  LucidePlus,
  LucideArrowDownWideNarrow,
  LucideArrowUpNarrowWide,
  LucideCalendarDays,
  LucideCalendarRange,
  LucideChevronRight,
  LucideColumns2,
  LucideColumns3,
  LucideFilterX,
  LucideSearch,
  LucideSquare,
  LucideX,
} from '@lucide/angular';

@Component({
  selector: 'app-posts',
  standalone: true,
  imports: [SocialSpotlightComponent, SocialShellComponent, 
    CommonModule,
    FormsModule,
    RouterLink,
    SocialMediaManagerComponent,
    ReportModalComponent,
    SocialPostContentComponent,
    LucideExternalLink,
    LucideFlag,
    LucideMaximize2,
    LucideMinimize2,
    LucideImage,
    LucideMessageCircle,
    LucidePlus,
    LucideArrowDownWideNarrow,
    LucideArrowUpNarrowWide,
    LucideCalendarDays,
    LucideCalendarRange,
    LucideChevronRight,
    LucideColumns2,
    LucideColumns3,
    LucideFilterX,
    LucideSearch,
    LucideSquare,
    LucideX,
    UserAvatarComponent
  ],
  templateUrl: './posts.html',
  styleUrls: ['../social-common.scss', './posts.scss']
})
export class PostsComponent implements OnInit, OnDestroy {
  private socialApi = inject(SocialApiService);
  private cdr = inject(ChangeDetectorRef);
  private meApi = inject(MeApiService);

  @ViewChild('createPostDialog') private createPostDialog?: ElementRef<HTMLDialogElement>;

  posts: SocialPostListItem[] = [];
  totalCount = 0;
  loading = false;
  loadError: string | null = null;
  createError: string | null = null;
  reportSuccessMessage: string | null = null;
  newPost: CreateSocialPostRequest = { postType: 'POST', boardCode: 'GENERAL', title: '', content: '', mediaIds: [] };

  pendingMedia: SocialMedia[] = [];
  pendingLayout: SocialMediaLayout = 'SECONDARY';

  readonly boardLabel = boardLabel;
  boardCodes: string[] = [];
  /** 發布器是否切成寬版（左寫右預覽），寫長文時使用 */
  postWide = false;

  /** 貼文牆每列幾則（1／2／3），記在瀏覽器裡，下次進來沿用 */
  wallCols: 1 | 2 | 3 = this.readWallCols();

  private readWallCols(): 1 | 2 | 3 {
    try {
      const saved = Number(localStorage.getItem('qmah-social-wall-cols'));
      return saved === 1 || saved === 3 ? saved : 2;
    } catch {
      return 2;
    }
  }

  setWallCols(cols: 1 | 2 | 3): void {
    this.wallCols = cols;
    try {
      localStorage.setItem('qmah-social-wall-cols', String(cols));
    } catch {
      // 瀏覽器不給存就只在這次有效
    }
  }

  /** 發布器可選的看板：與篩選選單同一份清單，不再只寫死兩個 */
  get composerBoards(): string[] {
    return this.boardCodes.length > 0 ? this.boardCodes : ['GENERAL'];
  }
  filterBoardCode = '';
  filterKeyword = '';
  /** 時間篩選（yyyy-MM-dd，空字串為不限）與排序（新到舊／舊到新） */
  filterFrom = '';
  filterTo = '';
  sortOrder: 'newest' | 'oldest' = 'newest';
  showDateFilter = false;
  readonly datePresets: { label: string; days: number | null }[] = [
    { label: '不限', days: null },
    { label: '今天', days: 0 },
    { label: '近 7 天', days: 6 },
    { label: '近 30 天', days: 29 },
  ];

  get hasDateFilter(): boolean {
    return !!(this.filterFrom || this.filterTo);
  }

  get dateFilterLabel(): string {
    if (!this.hasDateFilter) return '時間';
    return (this.filterFrom || '…') + ' ～ ' + (this.filterTo || '…');
  }

  private static ymd(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  applyDatePreset(days: number | null): void {
    if (days === null) {
      this.filterFrom = '';
      this.filterTo = '';
    } else {
      const today = new Date();
      const from = new Date();
      from.setDate(today.getDate() - days);
      this.filterFrom = PostsComponent.ymd(from);
      this.filterTo = PostsComponent.ymd(today);
    }
    this.loadPosts();
  }

  toggleSort(): void {
    this.sortOrder = this.sortOrder === 'newest' ? 'oldest' : 'newest';
    this.loadPosts();
  }

  // 實際欄數 = 使用者選的欄數，再依視窗寬度縮減（與 posts.scss 的斷點一致：≤1100px 最多 2 欄、≤640px 1 欄）。
  private readonly narrowQuery = this.mediaQuery('(max-width: 640px)');
  private readonly mediumQuery = this.mediaQuery('(max-width: 1100px)');
  private readonly onWallResize = () => this.cdr.detectChanges();

  private mediaQuery(query: string): MediaQueryList | null {
    return typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;
  }

  // 依序輪流分到各欄：第 1 篇第 1 欄、第 2 篇第 2 欄、…，所以閱讀順序就是新到舊。
  get postColumns(): SocialPostListItem[][] {
    if (this.posts.length === 0) return [];
    let count: number = this.wallCols;
    if (this.mediumQuery?.matches) count = Math.min(count, 2);
    if (this.narrowQuery?.matches) count = 1;
    const columns: SocialPostListItem[][] = Array.from({ length: count }, () => []);
    this.posts.forEach((post, index) => columns[index % count].push(post));
    return columns;
  }

  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly boardStore = inject(SocialBoardsStore);

  ngOnInit(): void {
    // 從公告、活動頁點看板回來時，網址帶 ?board=，直接套用成目前看板
    const board = this.route?.snapshot.queryParamMap.get('board');
    if (board) this.filterBoardCode = board;
    this.narrowQuery?.addEventListener('change', this.onWallResize);
    this.mediumQuery?.addEventListener('change', this.onWallResize);
    this.loadPosts();
    this.loadUpcomingEvents();
    this.boardStore.load().subscribe({
      next: (boards) => {
        this.boardCodes = boards;
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => console.error('取得看板清單失敗:', err)
    });
  }

  ngOnDestroy(): void {
    this.narrowQuery?.removeEventListener('change', this.onWallResize);
    this.mediumQuery?.removeEventListener('change', this.onWallResize);
  }

  /** 近期活動（尚未開始的前兩場），給貼文牆頂端的快速入口 */
  upcomingEvents: EventListItem[] = [];

  private loadUpcomingEvents(): void {
    this.socialApi.getEvents({ startAfter: new Date().toISOString(), pageSize: 2 }).subscribe({
      next: (page) => {
        this.upcomingEvents = page.items;
        this.cdr.detectChanges();
      },
      error: () => { this.upcomingEvents = []; }
    });
  }

  openCreatePost(): void {
    // ui-integration: 由 Angular 保留對話框的 focus／Escape 行為，避免依賴全域 id 變數開啟發布流程。
    // 管理員示範用：表單是空的才預填，不會蓋掉已經在寫的內容。
    if (isDemoAdmin(this.meApi.me()) && !this.newPost.title.trim() && !this.newPost.content.trim()) {
      this.newPost = demoPost();
    }
    this.createPostDialog?.nativeElement.showModal();
  }

  /** 左側看板分類／手機標籤：切換看板並重新載入（與篩選列的下拉同一個狀態）。 */
  selectBoard(code: string): void {
    this.filterBoardCode = code;
    this.loadPosts();
  }

  resetFilters(): void {
    this.filterFrom = '';
    this.filterTo = '';
    this.filterBoardCode = '';
    this.filterKeyword = '';
    this.loadPosts();
  }

  readonly socialColors = SOCIAL_COLORS;
  readonly stripMarkup = stripSocialMarkup;

  private get contentTextarea(): HTMLTextAreaElement | null {
    return document.querySelector('#social-post-content');
  }

  /** 更新內容並還原選取範圍（ngModel 會非同步寫回 DOM，所以延後一個 tick 再選取）。 */
  private applyContent(textarea: HTMLTextAreaElement, value: string, selStart: number, selEnd: number): void {
    this.newPost.content = value;
    textarea.focus();
    setTimeout(() => textarea.setSelectionRange(selStart, selEnd));
  }

  /**
   * 用成對標記包住選取文字，例如 [b]…[/b]、[color=red]…[/color]。
   * 沒有選取時插入「成對標記」並把游標放在中間；選取內容已被同一組標記包住（或游標正好在空標記中）時再按一次會取消。
   */
  wrapPostContent(open: string, close: string): void {
    const textarea = this.contentTextarea;
    if (!textarea) return;
    const value = textarea.value;
    const { selectionStart: start, selectionEnd: end } = textarea;
    const selected = value.slice(start, end);
    const same = (x: string, y: string) => x.toLowerCase() === y.toLowerCase();

    if (selected.length >= open.length + close.length && same(selected.slice(0, open.length), open) && same(selected.slice(-close.length), close)) {
      const inner = selected.slice(open.length, selected.length - close.length);
      this.applyContent(textarea, value.slice(0, start) + inner + value.slice(end), start, start + inner.length);
      return;
    }
    const before = value.slice(Math.max(0, start - open.length), start);
    const after = value.slice(end, end + close.length);
    if (same(before, open) && same(after, close)) {
      this.applyContent(textarea, value.slice(0, start - open.length) + selected + value.slice(end + close.length), start - open.length, start - open.length + selected.length);
      return;
    }
    const next = value.slice(0, start) + open + selected + close + value.slice(end);
    const caretStart = start + open.length;
    this.applyContent(textarea, next, caretStart, caretStart + selected.length);
  }

  /** 插入連結：有選取文字就包起來，網址欄位預先選取好；沒選取就插入範例文字。 */
  insertPostLink(): void {
    const textarea = this.contentTextarea;
    if (!textarea) return;
    const value = textarea.value;
    const { selectionStart: start, selectionEnd: end } = textarea;
    const label = value.slice(start, end) || '連結文字';
    const open = '[url=https://';
    const insert = open + ']' + label + '[/url]';
    const urlStart = start + open.length - 'https://'.length;
    this.applyContent(textarea, value.slice(0, start) + insert + value.slice(end), urlStart, urlStart + 'https://'.length);
  }

  /** 在游標處插入分隔線（獨立一行）。 */
  insertPostRule(): void {
    const textarea = this.contentTextarea;
    if (!textarea) return;
    const value = textarea.value;
    const at = textarea.selectionEnd;
    const head = value.slice(0, at);
    const lead = head.length === 0 || head.endsWith('\n') ? '' : '\n';
    const insert = lead + '[hr]\n';
    this.applyContent(textarea, head + insert + value.slice(at), at + insert.length, at + insert.length);
  }

  /** 把選取的每一行變成清單項目；沒有選取時插入一個空清單並把游標放在第一項。 */
  insertPostList(): void {
    const textarea = this.contentTextarea;
    if (!textarea) return;
    const value = textarea.value;
    const { selectionStart: start, selectionEnd: end } = textarea;
    const lines = value.slice(start, end).split('\n').map(line => line.trim()).filter(Boolean);
    const items = lines.length ? lines : [''];
    const text = '[list]\n' + items.map(line => '[*]' + line).join('\n') + '\n[/list]';
    const caret = lines.length ? start + text.length : start + '[list]\n[*]'.length;
    this.applyContent(textarea, value.slice(0, start) + text + value.slice(end), caret, caret);
  }

  /** 在游標處插入空行（分段），不會刪掉選取的文字。 */
  insertPostBreak(): void {
    const textarea = this.contentTextarea;
    if (!textarea) return;
    const value = textarea.value;
    const at = textarea.selectionEnd;
    const head = value.slice(0, at);
    const insert = head.endsWith('\n\n') ? '' : head.endsWith('\n') ? '\n' : '\n\n';
    this.applyContent(textarea, head + insert + value.slice(at), at + insert.length, at + insert.length);
  }

  // GET /api/v1/social/posts（AllowAnonymous，回傳 ApiPage<SocialPostListItemDto>）
  loadPosts(): void {
    this.loading = true;
    this.loadError = null;
    this.socialApi.getPosts({
      pageSize: 20,
      boardCode: this.filterBoardCode || undefined,
      q: this.filterKeyword || undefined,
      // 日期是本地時間：起＝當天 00:00，迄＝隔天 00:00（不含）
      createdAfter: this.filterFrom ? new Date(this.filterFrom + 'T00:00:00').toISOString() : undefined,
      createdBefore: this.filterTo ? new Date(new Date(this.filterTo + 'T00:00:00').getTime() + 86_400_000).toISOString() : undefined,
      sort: this.sortOrder
    }).subscribe({
      next: (page) => {
        // 後端新版會依 sort 排序；這裡再排一次，舊版 API 沒有 sort 參數時切換也有效。
        const dir = this.sortOrder === 'oldest' ? 1 : -1;
        this.posts = [...page.items].sort((a, b) => dir * (Date.parse(a.createdAt) - Date.parse(b.createdAt)));
        this.totalCount = page.totalCount;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        console.error('取得貼文失敗:', err);
        this.loadError = '取得貼文失敗，請稍後再試。';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // POST /api/v1/social/posts（需要登入 + XSRF token）
  // 送出按鈕是 type="button"，故意不靠 <form method="dialog"> 自動關閉視窗，
  // 避免請求還沒回來、或失敗時視窗就先關掉導致看不到錯誤訊息。
  submitPost(): void {
    this.createError = null;
    this.socialApi.createPost({ ...this.newPost, mediaIds: this.pendingMedia.map((item) => item.id), mediaLayout: this.pendingLayout }).subscribe({
      next: () => {
        this.newPost = { postType: 'POST', boardCode: 'GENERAL', title: '', content: '', mediaIds: [] };
        this.pendingMedia = [];
        this.pendingLayout = 'SECONDARY';
        this.loadPosts();
        this.createPostDialog?.nativeElement.close();
      },
      error: (err: HttpErrorResponse) => {
        this.createError = err.status === 401 ? '發布失敗：請先登入。' : '發布貼文失敗，請確認欄位是否正確。';
        console.error('發布貼文失敗:', err);
      }
    });
  }

  onReported(): void {
    this.reportSuccessMessage = '已送出檢舉，管理員審核後會處理。';
    this.cdr.detectChanges();
  }

}
