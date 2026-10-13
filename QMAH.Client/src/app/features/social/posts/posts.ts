import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { MeApiService } from '../../../core/services/me-api';
import { demoPost, isDemoAdmin } from '../social-demo';
import { UserAvatarComponent } from '../../../shared/components/user-avatar/user-avatar';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, forkJoin, map, of, Subscription } from 'rxjs';

import { ApiPage, CreateSocialPostRequest, EventListItem, SocialApiService, SocialMedia, SocialPopularPost, SocialPopularPosts, SocialPostListItem } from '../../../core/services/social-api';
import { moderationMessage } from '../social-moderation';
import { SocialMediaLayout, SocialMediaManagerComponent } from '../../../shared/components/social-media-manager/social-media-manager';
import { ReportModalComponent } from '../../../shared/components/report-modal/report-modal';
import { SocialPostContentComponent } from '../../../shared/components/social-post-content/social-post-content';
import { SocialEventContentComponent } from '../../../shared/components/social-event-content/social-event-content';
import { SOCIAL_COLORS, stripSocialMarkup } from '../../../shared/social-markup';
import { boardLabel, eventMode, eventPlace } from '../social-labels';
import { SocialShellComponent } from '../../../shared/components/social-shell/social-shell';
import { SocialBoardsStore } from '../social-boards';
import { SocialViewPreferences } from '../../../core/services/social-view-preferences';
import { SocialLive } from '../../../core/services/social-live';
import { BoardIconComponent } from '../../../shared/components/board-icon/board-icon';
import { SocialCardGalleryComponent } from '../../../shared/components/social-card-gallery/social-card-gallery';
import { SocialSpotlightComponent } from '../../../shared/components/social-spotlight/social-spotlight';
import {
  LucideBookmark,
  LucideFlag,
  LucideFlame,
  LucideFoldHorizontal,
  LucideUnfoldHorizontal,

  LucideImage,
  LucideMessageCircle,
  LucidePlus,
  LucideArrowDownWideNarrow,
  LucideArrowUpNarrowWide,
  LucideCalendarDays,
  LucideCalendarRange,
  LucideArrowRightLeft,
  LucideChevronDown,
  LucideChevronLeft,
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
  imports: [SocialSpotlightComponent, SocialShellComponent, SocialCardGalleryComponent, BoardIconComponent,
    CommonModule,
    FormsModule,
    RouterLink,
    SocialMediaManagerComponent,
    ReportModalComponent,
    SocialPostContentComponent,
    SocialEventContentComponent,
    LucideBookmark,
    LucideFlag,
    LucideFlame,
    LucideFoldHorizontal,
  LucideUnfoldHorizontal,
  
    LucideImage,
    LucideMessageCircle,
    LucidePlus,
    LucideArrowDownWideNarrow,
    LucideArrowUpNarrowWide,
    LucideCalendarDays,
    LucideCalendarRange,
    LucideArrowRightLeft,
    LucideChevronDown,
    LucideChevronLeft,
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
  protected socialApi = inject(SocialApiService);
  private cdr = inject(ChangeDetectorRef);
  private meApi = inject(MeApiService);
  private socialLive = inject(SocialLive);

  @ViewChild('createPostDialog') private createPostDialog?: ElementRef<HTMLDialogElement>;
  private postObserver?: IntersectionObserver;
  private postSentinel?: HTMLElement;
  private loadedPage = 1;
  private totalPages = 1;
  @ViewChild('postSentinel') set loadMoreSentinel(value: ElementRef<HTMLElement> | undefined) {
    this.postObserver?.disconnect();
    this.postSentinel = value?.nativeElement;
    if (!this.postSentinel || typeof IntersectionObserver === 'undefined') return;
    this.postObserver = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting) && !this.loadError) this.loadMorePosts();
    }, { rootMargin: '0px 0px 1800px 0px' });
    this.postObserver.observe(this.postSentinel);
  }
  get hasMorePosts(): boolean { return this.loadedPage < this.totalPages && this.posts.length < this.totalCount; }

  posts: SocialPostListItem[] = [];
  private postsRequest?: Subscription;
  private liveSubscription?: Subscription;
  private liveRefreshRequest?: Subscription;
  private pendingLiveRefresh = false;
  private refreshingLive = false;
  private cacheFilterKey = '';
  private readonly sortedPages = new Map<'newest' | 'oldest', ApiPage<SocialPostListItem>>();
  totalCount = 0;
  popular: SocialPopularPosts | null = null;
  popularOffset = 0;
  discoveryTab: 'events' | 'popular' = 'events';
  private discoveryLoaded = false;
  private discoveryRequest?: Subscription;
  liveUpdateNotice = '';
  loading = false;
  loadError: string | null = null;
  createError: string | null = null;
  creating = false;
  reportSuccessMessage: string | null = null;
  newPost: CreateSocialPostRequest = { postType: 'POST', boardCode: 'GENERAL', title: '', content: '', mediaIds: [] };

  pendingMedia: SocialMedia[] = [];
  pendingLayout: SocialMediaLayout = 'SECONDARY';

  readonly boardLabel = boardLabel;
  boardCodes: string[] = [];
  /** 加寬編輯區；預覽獨立切換，不瓜分書寫空間。 */
  postWide = false;
  postPreview = false;
  readonly view = inject(SocialViewPreferences);

  /** 貼文牆每列幾則（1／2／3），記在瀏覽器裡，下次進來沿用 */
  wallCols: 1 | 2 | 3 = this.readWallCols();

  // 沒存過偏好時：寬版預設三欄，窄版兩欄。
  private readWallCols(): 1 | 2 | 3 {
    const fallback = this.view.wide() ? 3 : 2;
    try {
      const saved = Number(localStorage.getItem('qmah-social-wall-cols'));
      return saved === 1 || saved === 2 || saved === 3 ? saved : fallback;
    } catch {
      return fallback;
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
    this.loadPosts(true);
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

  isEventPost(post: SocialPostListItem): boolean {
    return post.postType === 'EVENT' || post.boardCode === 'EVENT' || post.boardCode === 'EVENTS' || !!post.eventId;
  }

  protected readonly eventMode = eventMode;
  protected readonly eventPlace = eventPlace;

  protected weekday(iso: string): string {
    return new Date(iso).toLocaleDateString('zh-TW', { weekday: 'short' });
  }

  private lastLoadedAt = 0;
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly router = inject(Router);

  /** 點卡片空白處＝點標題：開啟貼文正文。連結、按鈕與圖片輪播自己的操作不算。 */
  openCard(event: MouseEvent, postId: string): void {
    if ((event.target as HTMLElement).closest('a, button, input, textarea, select, [role="button"], app-social-card-gallery')) return;
    if (window.getSelection()?.toString()) return;
    void this.router.navigate(['/social/posts', postId]);
  }
  private readonly boardStore = inject(SocialBoardsStore);

  ngOnInit(): void {
    // 從公告、活動頁點看板回來時，網址帶 ?board=，直接套用成目前看板
    const board = this.route?.snapshot.queryParamMap.get('board');
    if (board) this.filterBoardCode = board;
    this.narrowQuery?.addEventListener('change', this.onWallResize);
    this.mediumQuery?.addEventListener('change', this.onWallResize);
    this.loadPosts();
    this.loadDiscovery();
    this.liveSubscription = this.socialLive.changes.subscribe(() => {
      // SocialLive 一連上線就會通知一次；剛載入完的資料還是新的，這時再整頁重抓只是多打一輪請求。
      if (Date.now() - this.lastLoadedAt < 8000) return;
      this.refreshFromSocial();
    });
    this.boardStore.load().subscribe({
      next: (boards) => {
        this.boardCodes = boards;
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => console.error('取得看板清單失敗:', err)
    });
  }

  ngOnDestroy(): void {
    this.postObserver?.disconnect();
    this.postsRequest?.unsubscribe();
    this.liveSubscription?.unsubscribe();
    this.liveRefreshRequest?.unsubscribe();
    this.discoveryRequest?.unsubscribe();
    this.eventPageRequest?.unsubscribe();
    if (this.suppressUpcomingClickTimer) clearTimeout(this.suppressUpcomingClickTimer);
    this.narrowQuery?.removeEventListener('change', this.onWallResize);
    this.mediumQuery?.removeEventListener('change', this.onWallResize);
  }

  /** 貼文牆頂端的近期活動輪播：每次最多載入六筆，左右按鈕再逐頁載入。 */
  upcomingEvents: EventListItem[] = [];
  upcomingEventsPage = 1;
  upcomingEventsTotalPages = 1;
  upcomingEventsTotalCount = 0;
  upcomingEventsOffset = 0;
  loadingEventPage = false;
  private upcomingEventsAnchor = '';
  private eventPageRequest?: Subscription;
  private upcomingTouchStart: { x: number; y: number } | null = null;
  private suppressUpcomingClick = false;
  private suppressUpcomingClickTimer?: ReturnType<typeof setTimeout>;

  get eventsPerSlide(): number {
    return this.narrowQuery?.matches ? 1 : 2;
  }

  get visibleUpcomingEvents(): EventListItem[] {
    return this.upcomingEvents.slice(this.upcomingEventsOffset, this.upcomingEventsOffset + this.eventsPerSlide);
  }

  get canGoToPreviousEvents(): boolean {
    return this.upcomingEventsOffset > 0 || this.upcomingEventsPage > 1;
  }

  get canGoToNextEvents(): boolean {
    return this.upcomingEventsOffset + this.eventsPerSlide < this.upcomingEvents.length ||
      this.upcomingEventsPage < this.upcomingEventsTotalPages;
  }

  get eventSlideLabel(): string {
    return this.slideRange(this.upcomingEventsOffset, this.upcomingEventsTotalCount);
  }

  private loadDiscovery(): void {
    this.discoveryRequest?.unsubscribe();
    this.eventPageRequest?.unsubscribe();
    this.loadingEventPage = false;
    this.upcomingEventsAnchor = new Date().toISOString();
    this.discoveryRequest = forkJoin({
      events: this.socialApi.getEvents({ startAfter: this.upcomingEventsAnchor, pageSize: 6 })
        .pipe(catchError(() => of(null))),
      popular: this.socialApi.getPopularPosts().pipe(catchError(() => of(null)))
    }).subscribe(({ events, popular }) => {
      this.upcomingEvents = events?.items ?? [];
      this.upcomingEventsPage = events?.page ?? 1;
      this.upcomingEventsTotalPages = events?.totalPages ?? 1;
      this.upcomingEventsTotalCount = events?.totalCount ?? this.upcomingEvents.length;
      this.upcomingEventsOffset = 0;
      this.popular = popular;
      this.popularOffset = 0;
      // 熱門區預設收起，等切換才下載縮圖會有明顯空窗；資料一到就先在背景載好前幾張（瀏覽器會快取）。
      for (const item of popular?.items ?? []) {
        if (item.coverImageUrl) new Image().src = item.coverImageUrl;
      }
      if (!this.discoveryLoaded) {
        this.discoveryTab = this.upcomingEvents.length ? 'events' : popular?.items.length ? 'popular' : 'events';
        this.discoveryLoaded = true;
      } else if (this.discoveryTab === 'events' && !this.upcomingEvents.length && popular?.items.length) {
        this.discoveryTab = 'popular';
      } else if (this.discoveryTab === 'popular' && !popular?.items.length && this.upcomingEvents.length) {
        this.discoveryTab = 'events';
      }
      this.cdr.detectChanges();
    });
  }

  previousEventSlide(): void {
    if (this.loadingEventPage || !this.canGoToPreviousEvents) return;
    if (this.upcomingEventsOffset > 0) {
      this.upcomingEventsOffset = Math.max(0, this.upcomingEventsOffset - this.eventsPerSlide);
      return;
    }
    this.loadEventPage(this.upcomingEventsPage - 1, Number.MAX_SAFE_INTEGER);
  }

  nextEventSlide(): void {
    if (this.loadingEventPage || !this.canGoToNextEvents) return;
    if (this.upcomingEventsOffset + this.eventsPerSlide < this.upcomingEvents.length) {
      this.upcomingEventsOffset += this.eventsPerSlide;
      return;
    }
    this.loadEventPage(this.upcomingEventsPage + 1, 0);
  }

  onUpcomingTouchStart(event: TouchEvent): void {
    const touch = event.touches[0];
    if (touch) this.upcomingTouchStart = { x: touch.clientX, y: touch.clientY };
  }

  onUpcomingTouchEnd(event: TouchEvent): void {
    const start = this.upcomingTouchStart;
    const touch = event.changedTouches[0];
    this.upcomingTouchStart = null;
    if (!start || !touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;

    this.suppressUpcomingClick = true;
    if (this.suppressUpcomingClickTimer) clearTimeout(this.suppressUpcomingClickTimer);
    this.suppressUpcomingClickTimer = setTimeout(() => (this.suppressUpcomingClick = false), 500);
    if (this.showingEvents) deltaX < 0 ? this.nextEventSlide() : this.previousEventSlide();
    else deltaX < 0 ? this.nextPopularSlide() : this.previousPopularSlide();
  }

  preventUpcomingSwipeNavigation(event: MouseEvent): void {
    if (!this.suppressUpcomingClick) return;
    event.preventDefault();
    event.stopPropagation();
    this.suppressUpcomingClick = false;
    if (this.suppressUpcomingClickTimer) clearTimeout(this.suppressUpcomingClickTimer);
  }

  private loadEventPage(page: number, offset: number): void {
    this.eventPageRequest?.unsubscribe();
    this.loadingEventPage = true;
    this.eventPageRequest = this.socialApi.getEvents({ startAfter: this.upcomingEventsAnchor, page, pageSize: 6 })
      .pipe(catchError(() => of(null)))
      .subscribe(result => {
        if (result) {
          this.upcomingEvents = result.items;
          this.upcomingEventsPage = result.page;
          this.upcomingEventsTotalPages = result.totalPages;
          this.upcomingEventsTotalCount = result.totalCount;
          this.upcomingEventsOffset = offset === Number.MAX_SAFE_INTEGER
            ? Math.max(0, result.items.length - this.eventsPerSlide)
            : offset;
        }
        this.loadingEventPage = false;
        this.cdr.detectChanges();
      });
  }

  get showingEvents(): boolean {
    return this.upcomingEvents.length > 0 && (this.discoveryTab === 'events' || !this.popular?.items.length);
  }

  toggleDiscoveryTab(): void {
    if (!this.upcomingEvents.length || !this.popular?.items.length) return;
    this.discoveryTab = this.showingEvents ? 'popular' : 'events';
  }

  get visiblePopular(): SocialPopularPost[] {
    return (this.popular?.items ?? []).slice(this.popularOffset, this.popularOffset + this.eventsPerSlide);
  }

  get canGoToPreviousPopular(): boolean {
    return this.popularOffset > 0;
  }

  get canGoToNextPopular(): boolean {
    return this.popularOffset + this.eventsPerSlide < (this.popular?.items.length ?? 0);
  }

  get popularSlideLabel(): string {
    return this.slideRange(this.popularOffset, this.popular?.items.length ?? 0);
  }

  previousPopularSlide(): void {
    this.popularOffset = Math.max(0, this.popularOffset - this.eventsPerSlide);
  }

  nextPopularSlide(): void {
    if (this.canGoToNextPopular) this.popularOffset += this.eventsPerSlide;
  }

  private slideRange(offset: number, total: number): string {
    const first = offset + 1;
    const last = Math.min(offset + this.eventsPerSlide, total);
    return first === last ? `${first} / ${total}` : `${first}–${last} / ${total}`;
  }

  /** 靜默更新已載入的牆面，確認被隱藏／刪除的文章後保留捲動位置。 */
  private refreshFromSocial(): void {
    if (this.loading || this.refreshingLive) {
      this.pendingLiveRefresh = true;
      return;
    }
    this.refreshingLive = true;
    const anchor = this.captureScrollAnchor();
    const currentIds = this.posts.map(post => post.id);
    const batches = Array.from({ length: Math.ceil(currentIds.length / 100) }, (_, index) =>
      this.socialApi.getVisiblePostIds(currentIds.slice(index * 100, (index + 1) * 100)));
    const visibleIds$ = batches.length ? forkJoin(batches).pipe(map(groups => groups.flat())) : of([] as string[]);
    this.liveRefreshRequest?.unsubscribe();
    this.liveRefreshRequest = forkJoin({
      firstPage: this.socialApi.getPosts(this.postQuery(1, this.sortOrder)),
      visibleIds: visibleIds$
    }).subscribe({
      next: ({ firstPage, visibleIds }) => {
        const visible = new Set(visibleIds);
        const merged = new Map<string, SocialPostListItem>();
        for (const post of this.posts) if (visible.has(post.id)) merged.set(post.id, post);
        for (const post of firstPage.items) merged.set(post.id, post);
        const direction = this.sortOrder === 'oldest' ? 1 : -1;
        this.posts = [...merged.values()].sort((a, b) => direction * (Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id)));
        this.totalCount = firstPage.totalCount;
        this.totalPages = firstPage.totalPages || Math.ceil(firstPage.totalCount / (firstPage.pageSize || 20));
        this.loadedPage = Math.min(this.loadedPage, Math.max(1, this.totalPages));
        this.sortedPages.set(this.sortOrder, firstPage);
        this.liveUpdateNotice = '';
        this.refreshingLive = false;
        this.cdr.detectChanges();
        this.restoreScrollAnchor(anchor);
        this.loadDiscovery();
        this.flushPendingLiveRefresh();
      },
      error: () => {
        this.refreshingLive = false;
        this.liveUpdateNotice = '更新延遲，稍後重試';
        this.cdr.detectChanges();
        this.flushPendingLiveRefresh();
      }
    });
  }

  private captureScrollAnchor(): { id: string; top: number } | null {
    const cards = [...document.querySelectorAll<HTMLElement>('[data-post-id]')];
    const element = cards.find(card => card.getBoundingClientRect().bottom > 0);
    return element ? { id: element.dataset['postId'] ?? '', top: element.getBoundingClientRect().top } : null;
  }

  private restoreScrollAnchor(anchor: { id: string; top: number } | null): void {
    if (!anchor?.id) return;
    requestAnimationFrame(() => {
      const element = document.querySelector<HTMLElement>(`[data-post-id="${anchor.id}"]`);
      if (element) window.scrollBy({ top: element.getBoundingClientRect().top - anchor.top, behavior: 'auto' });
    });
  }

  private flushPendingLiveRefresh(): void {
    if (!this.pendingLiveRefresh || this.loading || this.refreshingLive) return;
    this.pendingLiveRefresh = false;
    this.refreshFromSocial();
  }

  openCreatePost(): void {
    this.postPreview = false;
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
  loadPosts(allowCached = false): void {
    this.postsRequest?.unsubscribe();
    const order = this.sortOrder;
    const filterKey = JSON.stringify([this.filterBoardCode, this.filterKeyword, this.filterFrom, this.filterTo]);
    if (!allowCached || filterKey !== this.cacheFilterKey) {
      this.sortedPages.clear();
      this.cacheFilterKey = filterKey;
    }
    const applyPage = (page: ApiPage<SocialPostListItem>) => {
      const dir = order === 'oldest' ? 1 : -1;
      this.posts = [...page.items].sort((a, b) => dir * (Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id)));
      this.totalCount = page.totalCount;
      this.loadedPage = page.page || 1;
      this.totalPages = page.totalPages || Math.ceil(page.totalCount / (page.pageSize || 20));
      this.loading = false;
      this.lastLoadedAt = Date.now();
      this.cdr.detectChanges();
      if (this.postSentinel) { this.postObserver?.unobserve(this.postSentinel); this.postObserver?.observe(this.postSentinel); }
      this.flushPendingLiveRefresh();
    };
    this.loadError = null;
    const cached = this.sortedPages.get(order);
    if (cached) { applyPage(cached); return; }
    this.loading = true;
    this.postsRequest = this.socialApi.getPosts(this.postQuery(1, order)).subscribe({
      next: (page) => {
        this.sortedPages.set(order, page);
        applyPage(page);
      },
      error: (err: HttpErrorResponse) => {
        console.error('取得貼文失敗:', err);
        this.loadError = err.status === 401 && this.bookmarksOnly ? '請先登入後再查看收藏的貼文。' : '取得貼文失敗，請稍後再試。';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  /** 導覽的「我的收藏」不是真的看板，而是 bookmarked 篩選。 */
  get bookmarksOnly(): boolean {
    return this.filterBoardCode === '@bookmarks';
  }

  private postQuery(page: number, sort = this.sortOrder) {
    return {
      page, pageSize: 20,
      boardCode: this.bookmarksOnly ? undefined : this.filterBoardCode || undefined,
      bookmarked: this.bookmarksOnly ? true : undefined,
      q: this.filterKeyword || undefined,
      createdAfter: this.filterFrom ? new Date(this.filterFrom + 'T00:00:00').toISOString() : undefined,
      createdBefore: this.filterTo ? new Date(new Date(this.filterTo + 'T00:00:00').getTime() + 86_400_000).toISOString() : undefined,
      sort,
    };
  }

  loadMorePosts(): void {
    if (this.loading || !this.hasMorePosts) return;
    this.loading = true;
    this.loadError = null;
    this.postsRequest = this.socialApi.getPosts(this.postQuery(this.loadedPage + 1)).subscribe({
      next: page => {
        const seen = new Set(this.posts.map(post => post.id));
        this.posts = [...this.posts, ...page.items.filter(post => !seen.has(post.id))];
        this.loadedPage = page.page;
        this.totalPages = page.totalPages;
        this.totalCount = page.totalCount;
        this.loading = false;
        this.cdr.detectChanges();
        // Reobserve after layout settles; a still-visible sentinel must not stall.
        if (this.postSentinel) { this.postObserver?.unobserve(this.postSentinel); this.postObserver?.observe(this.postSentinel); }
        this.flushPendingLiveRefresh();
      },
      error: () => {
        this.loading = false;
        this.loadError = '後面的貼文暫時無法載入，請按「載入更多」再試一次。';
        this.cdr.detectChanges();
        this.flushPendingLiveRefresh();
      },
    });
  }

  bookmarkNotice: string | null = null;
  private readonly bookmarking = new Set<string>();

  // 收藏／取消收藏：先改畫面再送出，失敗就還原；「我的收藏」清單裡取消收藏會直接把該篇移走。
  toggleBookmark(post: SocialPostListItem): void {
    if (this.bookmarking.has(post.id)) return;
    this.bookmarking.add(post.id);
    this.bookmarkNotice = null;
    const wanted = !post.isBookmarked;
    post.isBookmarked = wanted;
    const request = wanted ? this.socialApi.bookmarkPost(post.id) : this.socialApi.unbookmarkPost(post.id);
    request.subscribe({
      next: () => {
        this.bookmarking.delete(post.id);
        if (!wanted && this.bookmarksOnly) {
          this.posts = this.posts.filter(item => item.id !== post.id);
          this.totalCount = Math.max(0, this.totalCount - 1);
        }
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        this.bookmarking.delete(post.id);
        post.isBookmarked = !wanted;
        this.bookmarkNotice = err.status === 401 ? '請先登入才能收藏貼文。' : '收藏失敗，請稍後再試。';
        this.cdr.detectChanges();
      },
    });
  }

  // POST /api/v1/social/posts（需要登入 + XSRF token）
  // 送出按鈕是 type="button"，故意不靠 <form method="dialog"> 自動關閉視窗，
  // 避免請求還沒回來、或失敗時視窗就先關掉導致看不到錯誤訊息。
  submitPost(): void {
    if (this.creating) return;
    this.creating = true;
    this.createError = null;
    this.socialApi.createPost({ ...this.newPost, mediaIds: this.pendingMedia.map((item) => item.id), mediaLayout: this.pendingLayout }).subscribe({
      next: () => {
        this.creating = false;
        this.newPost = { postType: 'POST', boardCode: 'GENERAL', title: '', content: '', mediaIds: [] };
        this.pendingMedia = [];
        this.pendingLayout = 'SECONDARY';
        this.loadPosts();
        this.createPostDialog?.nativeElement.close();
      },
      error: (err: HttpErrorResponse) => {
        this.creating = false;
        this.createError = err.status === 401 ? '發布失敗：請先登入。' : moderationMessage(err) ?? '發布貼文失敗，請確認欄位是否正確。';
        console.error('發布貼文失敗:', err);
        this.cdr.detectChanges();
      }
    });
  }

  onReported(): void {
    this.reportSuccessMessage = '已送出檢舉，管理員審核後會處理。';
    this.cdr.detectChanges();
  }

}
