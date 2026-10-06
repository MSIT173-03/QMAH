import { GameRewardMeterComponent } from './game-reward-meter.component';
import { GameFocusMode } from '../core/services/game-focus-mode';
import { DatePipe } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, HostListener, Component, DestroyRef, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { GameAppreciationRulesComponent } from './game-appreciation-rules.component';
import { GameAppreciationConfirmComponent } from './game-appreciation-confirm.component';
import { GameNavigationComponent } from './game-navigation.component';
import { GameService } from './game.service';
import { AppreciationAnswer, ApiPage } from './game.models';
import { CatalogService } from '../services/catalog-service';
import { CategoryModel, EraModel } from '../models/catalog-model';

@Component({
  selector: 'app-game-appreciation',
  imports: [GameAppreciationRulesComponent, GameAppreciationConfirmComponent, GameRewardMeterComponent, DatePipe, RouterLink, FormsModule, GameNavigationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './game-appreciation.component.scss',
  template: `
    <section class="appreciation-scene" [class.is-focus-mode]="focusMode.active()" aria-labelledby="appreciation-title">
      <app-game-navigation><app-game-reward-meter /></app-game-navigation>
      <div class="appreciation-stage">
      <header><div><h1 id="appreciation-title">鑑賞回答</h1><p>看看玩家怎麼解讀文物，把票投給你喜歡的回答。</p></div><a routerLink="/artifact-list">返回圖鑑</a></header>
      <div #sentinel class="filters-sentinel" aria-hidden="true"></div>
      <div class="filters-slot" [class.is-sheet]="sheetOpen()" [style.--filters-h.px]="naturalHeight()">
      <form #filtersForm class="filters" [class.is-sheet]="sheetOpen()" [attr.role]="sheetOpen() ? 'dialog' : null" [attr.aria-modal]="sheetOpen() ? 'true' : null" aria-label="篩選鑑賞回答" (ngSubmit)="search(); closeSheet()">
        <div class="filters-sheet-head"><strong>篩選與搜尋</strong><button type="button" (click)="closeSheet()">完成</button></div>
        <div class="artifact-search">
          <label for="appreciation-search">找文物</label>
          <div><input id="appreciation-search" type="search" name="keyword" [(ngModel)]="searchText" maxlength="100" placeholder="名稱、編號或年代" aria-label="搜尋文物，可輸入名稱、編號、年代或分類" /><button type="submit">搜尋</button></div>
        </div>
        <details class="filter-options"><summary><svg class="fo-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></svg><span class="fo-text">篩選與排序</span>@if (hasFilters) { <span class="fo-badge">已套用篩選</span> }</summary><div class="filter-options__fields">
        <label>排序<select name="sort" [(ngModel)]="sort" (ngModelChange)="load(1)"><option value="votes">鑑賞票數最多</option><option value="time">最新完成</option></select></label>
        <label>文物分類<select name="category" [(ngModel)]="categoryCode" (ngModelChange)="load(1)"><option value="">全部分類</option>@for (category of categories(); track category.id) { <option [value]="category.code">{{ category.name }}</option> }</select></label>
        <label>文物年代<select name="era" [(ngModel)]="eraCode" (ngModelChange)="load(1)"><option value="">全部年代</option>@for (era of eras(); track era.id) { <option [value]="era.code">{{ era.name }}</option> }</select></label>
        @if (hasFilters) { <button type="button" (click)="clearFilters()">清除篩選</button> }
        </div></details>
        <div class="type-filter" role="group" aria-label="篩選回答類型">
          <span>回答類型</span>
          <div class="category-index">
            @for (type of answerTypes; track type) { <button type="button" (click)="selectAnswerType(type)" [attr.aria-pressed]="answerType === type">{{ type ? typeLabel(type) : '全部' }}</button> }
          </div>
        </div>
      </form>
      </div>
      @if (sheetOpen()) { <div class="filters-backdrop" (click)="closeSheet()"></div> }
      @if (artifactId) { <div class="artifact-filter"><span>只看：<strong>{{ artifactName || '指定文物' }}</strong></span><button type="button" (click)="showAll()">取消文物限制</button></div> }
      @if (error()) { <p role="alert">{{ error() }} <button type="button" (click)="load(currentPage())">重新讀取</button></p> }
      @if (loading()) { <p role="status">正在整理鑑賞回答…</p> }
      <div class="collection-heading"><h2>入選回答</h2>@if (result(); as page) { <span>{{ page.totalCount }} 則符合條件</span> }
        <app-game-appreciation-rules />
      </div>
      <div class="collection-answers">
      @for (group of answerGroups(); track group.type) {
      <section class="answer-category" [attr.id]="'answers-' + group.type" [attr.aria-labelledby]="'heading-' + group.type">
      <h2 class="category-title" [attr.id]="'heading-' + group.type">{{ typeLabel(group.type) }}<span>本頁 {{ group.items.length }} 則回答</span></h2>
      <ol class="answer-gallery" [attr.aria-busy]="loading()">
        @for (answer of group.items; track answer.id) {
          <li [attr.data-type]="answer.answerType">
            @if (answer.imagePath) { <img class="answer-photo" [src]="answer.imagePath" [alt]="answer.artifactName" loading="lazy" (error)="$any($event.target).hidden = true" /> }
            <div class="answer-heading"><span>{{ typeLabel(answer.answerType) }}</span><h3>{{ answer.artifactName }}</h3><small>{{ answer.categoryName }}</small></div>
            @if (!artifactId) { <button type="button" class="artifact-pick" (click)="selectArtifact(answer)">只看這件文物</button> }
            <p class="answer-text">{{ answer.text }}</p>
            @if (answer.answerType !== 'FACTUAL_REASONING') { <p class="source-note">{{ answer.answerType === 'PLAUSIBLE_FICTION' ? '虛構說明，並非文物史實。' : '創意故事，並非文物史實。' }}</p> }
            <footer><div><strong>{{ answer.author }}</strong><span>房間 {{ answer.roomCode }} · {{ answer.completedAt | date:'yyyy/MM/dd HH:mm' }}</span><span>入選時 {{ answer.gameVotes }} 張遊戲票</span></div>
              <div class="vote-action"><span><strong>{{ answer.voteCount }}</strong> 鑑賞票</span><button type="button" [attr.aria-pressed]="answer.voted" [disabled]="!!pendingVote() || answer.isOwn || loading()" (click)="openConfirmation(answer)">{{ answer.isOwn ? '你的回答' : pendingVote() === answer.id ? '送出中…' : answer.voted ? '收回鑑賞票' : '投一票' }}</button></div>
            </footer>
          </li>
        }
      </ol>
      </section>
      } @empty { @if (!loading() && !error()) { <p class="empty">{{ hasFilters ? '找不到符合條件的回答，可以換個關鍵字或清除篩選。' : '目前還沒有入選回答。多人遊戲完成後，三種類型的第一名回答就會出現在這裡。' }}</p> } }
      </div>
      @if (result(); as page) { @if (page.totalPages > 1) { <nav class="pagination" aria-label="鑑賞回答分頁"><button type="button" [disabled]="loading() || page.page <= 1" (click)="load(page.page - 1)">上一頁</button><span>{{ page.page }}／{{ page.totalPages }} 頁</span><button type="button" [disabled]="loading() || page.page >= page.totalPages" (click)="load(page.page + 1)">下一頁</button></nav> } }
      </div>
      @if (stuck()) {
        <div class="jump-dock">
          <button type="button" class="jump-btn jump-filter" (click)="openSheet()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></svg>篩選@if (hasFilters) { <i class="jump-badge" aria-label="已套用篩選"></i> }</button>
          <button type="button" class="jump-btn jump-top" data-button-tone="neutral" (click)="toTop()" aria-label="回到頂部"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 14 6-6 6 6M12 8v11" /></svg><span>回到頂部</span></button>
        </div>
      }
      <app-game-appreciation-confirm [pending]="pendingVote()" (confirmed)="vote($event)" />
    </section>
  `
})
export class GameAppreciationComponent implements AfterViewInit {
  protected readonly focusMode = inject(GameFocusMode);
  readonly answerTypes = ['', 'FACTUAL_REASONING', 'PLAUSIBLE_FICTION', 'CREATIVE_TALE'];
  private readonly game = inject(GameService);
  private readonly catalog = inject(CatalogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly result = signal<ApiPage<AppreciationAnswer> | null>(null);
  readonly answerGroups = computed(() => {
    const items = this.result()?.items ?? [];
    const types = [...new Set(['FACTUAL_REASONING', 'PLAUSIBLE_FICTION', 'CREATIVE_TALE', ...items.map(answer => answer.answerType)])];
    return types.map(type => ({ type, items: items.filter(answer => answer.answerType === type) })).filter(group => group.items.length);
  });
  readonly categories = signal<CategoryModel[]>([]);
  readonly eras = signal<EraModel[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly pendingVote = signal('');
  @ViewChild(GameAppreciationConfirmComponent) private confirmation?: GameAppreciationConfirmComponent;
  @ViewChild('sentinel') private sentinel?: ElementRef<HTMLElement>;
  @ViewChild('filtersForm') private filtersForm?: ElementRef<HTMLElement>;
  // 捲過篩選器後它會縮成一條，點開才展開；縮起來時保留原本高度，內容不會跳動
  readonly stuck = signal(false);
  readonly sheetOpen = signal(false);
  readonly naturalHeight = signal(0);
  readonly currentPage = signal(1);
  sort = 'votes';
  answerType = '';
  categoryCode = '';
  eraCode = '';
  searchText = '';
  keyword = '';
  artifactName = '';
  artifactId = this.route.snapshot.queryParamMap.get('artifactId') ?? '';
  private requestVersion = 0;
  constructor() {
    this.catalog.getCategories().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: categories => this.categories.set(categories), error: () => this.error.set('文物分類暫時無法讀取，仍可查看回答。') });
    this.catalog.getEras().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: eras => this.eras.set(eras), error: () => this.error.set('文物年代暫時無法讀取，仍可查看回答。') });
    this.load(1);
  }
  ngAfterViewInit(): void {
    const sentinel = this.sentinel?.nativeElement;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      const stage = this.host.nativeElement.querySelector<HTMLElement>('.appreciation-stage');
      const scrollsInside = stage && /(auto|scroll)/.test(getComputedStyle(stage).overflowY);
      const visibleTop = Math.max(entry.rootBounds?.top ?? 0, scrollsInside ? stage.getBoundingClientRect().top : 0);
      const out = !entry.isIntersecting && entry.boundingClientRect.top < visibleTop + 8;
      if (out && !this.stuck()) this.naturalHeight.set(this.filtersForm?.nativeElement.offsetHeight ?? 0);
      if (!out) this.sheetOpen.set(false);
      this.stuck.set(out);
    });
    observer.observe(sentinel);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }
  openSheet(): void {
    this.sheetOpen.set(true);
    setTimeout(() => this.filtersForm?.nativeElement.querySelector<HTMLInputElement>('input[type="search"]')?.focus());
  }
  closeSheet(): void { this.sheetOpen.set(false); }
  @HostListener('document:keydown.escape') protected onEscape(): void { this.closeSheet(); }
  toTop(): void {
    const stage = this.host.nativeElement.querySelector<HTMLElement>('.appreciation-stage');
    const smooth: ScrollBehavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
    if (stage && stage.scrollHeight > stage.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(stage).overflowY)) stage.scrollTo({ top: 0, behavior: smooth });
    else window.scrollTo({ top: 0, behavior: smooth });
  }
  typeLabel(type: string): string { return ({ FACTUAL_REASONING: '史實推理', PLAUSIBLE_FICTION: '擬真異說', CREATIVE_TALE: '妙想奇談' } as Record<string, string>)[type] ?? type; }
  selectAnswerType(type: string): void { if (this.answerType !== type) { this.answerType = type; this.load(1); } }
  get hasFilters(): boolean { return !!(this.artifactId || this.keyword || this.eraCode || this.categoryCode || this.answerType); }
  search(): void { this.keyword = this.searchText.trim(); this.load(1); }
  selectArtifact(answer: AppreciationAnswer): void { this.artifactId = answer.artifactId; this.artifactName = answer.artifactName; this.load(1); }
  showAll(): void { this.artifactId = ''; this.artifactName = ''; this.load(1); }
  clearFilters(): void {
    this.artifactId = ''; this.artifactName = ''; this.searchText = ''; this.keyword = '';
    this.eraCode = ''; this.categoryCode = ''; this.answerType = ''; this.load(1);
  }
  load(page: number): void {
    const version = ++this.requestVersion;
    this.loading.set(true);
    this.currentPage.set(page);
    this.game.getAppreciation({ artifactId: this.artifactId, categoryCode: this.categoryCode, answerType: this.answerType, sort: this.sort, page, keyword: this.keyword, eraCode: this.eraCode }).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => { if (version === this.requestVersion) this.loading.set(false); })).subscribe({
      next: result => { if (version === this.requestVersion) { this.result.set(result); this.error.set(''); if (this.artifactId && result.items.length) this.artifactName = result.items[0].artifactName; } },
      error: () => { if (version === this.requestVersion) this.error.set('鑑賞回答暫時無法讀取，請再試一次。'); }
    });
  }
  openConfirmation(answer: AppreciationAnswer): void {
    if (this.pendingVote() || answer.isOwn || this.loading()) return;
    this.confirmation?.open(answer);
  }
  vote(answer: AppreciationAnswer): void {
    if (this.pendingVote() || answer.isOwn) return;
    this.pendingVote.set(answer.id);
    this.game.voteAppreciation(answer.id, !answer.voted).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.pendingVote.set(''))).subscribe({ next: () => this.load(this.currentPage()), error: () => this.error.set('投票尚未完成，請再試一次。') });
  }
}
