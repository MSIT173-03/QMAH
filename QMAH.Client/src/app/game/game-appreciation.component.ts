import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { GameNavigationComponent } from './game-navigation.component';
import { GameService } from './game.service';
import { AppreciationAnswer, ApiPage } from './game.models';
import { CatalogService } from '../services/catalog-service';
import { CategoryModel, EraModel } from '../models/catalog-model';

@Component({
  selector: 'app-game-appreciation',
  imports: [DatePipe, RouterLink, FormsModule, GameNavigationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './game-appreciation.component.scss',
  template: `
    <section class="appreciation-scene" aria-labelledby="appreciation-title">
      <app-game-navigation />
      <header><h1 id="appreciation-title">鑑賞回答</h1><p>看看玩家怎麼解讀文物，把票投給你喜歡的回答。</p><a routerLink="/artifact-list">返回圖鑑</a></header>
      <details class="rules"><summary>哪些回答會入選？</summary>
        <p>每局多人遊戲結束後，三種類型各取遊戲得票最高的一則回答。同票時先送出者優先，再依回答識別碼決定。</p>
        <p>沒有回答的類型不會入選。鑑賞票另計，不影響遊戲勝負與獎勵。每則回答可投一票，也可收回，不能投自己的回答。</p>
        <p>【史實推理】推測文物真正的名稱、用途、年代或背景。玩家的推測仍需與文物資料核對。</p>
        <p>【擬真異說】看似合理的虛構說明。【妙想奇談】幽默、誇張或帶有故事性的創意回答。</p>
      </details>
      <form class="filters" aria-label="篩選鑑賞回答" (ngSubmit)="search()">
        <div class="artifact-search">
          <label for="appreciation-search">找文物</label>
          <div><input id="appreciation-search" type="search" name="keyword" [(ngModel)]="searchText" maxlength="100" placeholder="搜尋編號／名稱／年代／分類" /><button type="submit">搜尋</button></div>
        </div>
        <details class="filter-options"><summary>篩選與排序@if (hasFilters) { <span>已套用篩選</span> }</summary><div class="filter-options__fields">
        <label>排序<select name="sort" [(ngModel)]="sort" (ngModelChange)="load(1)"><option value="votes">鑑賞票數最多</option><option value="time">最新完成</option></select></label>
        <label>回答類型<select name="type" [(ngModel)]="answerType" (ngModelChange)="load(1)"><option value="">全部類型</option><option value="FACTUAL_REASONING">史實推理</option><option value="PLAUSIBLE_FICTION">擬真異說</option><option value="CREATIVE_TALE">妙想奇談</option></select></label>
        <label>文物分類<select name="category" [(ngModel)]="categoryCode" (ngModelChange)="load(1)"><option value="">全部分類</option>@for (category of categories(); track category.id) { <option [value]="category.code">{{ category.name }}</option> }</select></label>
        <label>文物年代<select name="era" [(ngModel)]="eraCode" (ngModelChange)="load(1)"><option value="">全部年代</option>@for (era of eras(); track era.id) { <option [value]="era.code">{{ era.name }}</option> }</select></label>
        @if (hasFilters) { <button type="button" (click)="clearFilters()">清除篩選</button> }
        </div></details>
      </form>
      @if (artifactId) { <div class="artifact-filter"><span>只看：<strong>{{ artifactName || '指定文物' }}</strong></span><button type="button" (click)="showAll()">取消文物限制</button></div> }
      @if (error()) { <p role="alert">{{ error() }} <button type="button" (click)="load(currentPage())">重新讀取</button></p> }
      @if (loading()) { <p role="status">正在整理鑑賞回答…</p> }
      <ol class="answer-gallery" [attr.aria-busy]="loading()">
        @for (answer of result()?.items; track answer.id) {
          <li>
            <div class="answer-heading"><span>{{ typeLabel(answer.answerType) }}</span><h2>{{ answer.artifactName }}</h2><small>{{ answer.categoryName }}</small></div>
            @if (!artifactId) { <button type="button" class="artifact-pick" (click)="selectArtifact(answer)">只看這件文物</button> }
            <p class="answer-text">{{ answer.text }}</p>
            @if (answer.answerType !== 'FACTUAL_REASONING') { <p class="source-note">{{ answer.answerType === 'PLAUSIBLE_FICTION' ? '虛構說明，並非文物史實。' : '創意故事，並非文物史實。' }}</p> }
            <footer><div><strong>{{ answer.author }}</strong><span>房間 {{ answer.roomCode }} · {{ answer.completedAt | date:'yyyy/MM/dd HH:mm' }}</span><span>入選時 {{ answer.gameVotes }} 張遊戲票</span></div>
              <button type="button" [attr.aria-pressed]="answer.voted" [disabled]="pendingVote() === answer.id || answer.isOwn || loading()" (click)="vote(answer)">{{ answer.isOwn ? '你的回答' : pendingVote() === answer.id ? '送出中…' : answer.voted ? '收回鑑賞票' : '投一票' }} · {{ answer.voteCount }}</button>
            </footer>
          </li>
        } @empty { @if (!loading() && !error()) { <li class="empty">{{ hasFilters ? '找不到符合條件的回答，可以換個關鍵字或清除篩選。' : '目前還沒有入選回答。多人遊戲完成後，三種類型的第一名回答就會出現在這裡。' }}</li> } }
      </ol>
      @if (result(); as page) { @if (page.totalPages > 1) { <nav class="pagination" aria-label="鑑賞回答分頁"><button type="button" [disabled]="loading() || page.page <= 1" (click)="load(page.page - 1)">上一頁</button><span>{{ page.page }}／{{ page.totalPages }} 頁</span><button type="button" [disabled]="loading() || page.page >= page.totalPages" (click)="load(page.page + 1)">下一頁</button></nav> } }
    </section>
  `
})
export class GameAppreciationComponent {
  private readonly game = inject(GameService);
  private readonly catalog = inject(CatalogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  readonly result = signal<ApiPage<AppreciationAnswer> | null>(null);
  readonly categories = signal<CategoryModel[]>([]);
  readonly eras = signal<EraModel[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly pendingVote = signal('');
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
  typeLabel(type: string): string { return ({ FACTUAL_REASONING: '史實推理', PLAUSIBLE_FICTION: '擬真異說', CREATIVE_TALE: '妙想奇談' } as Record<string, string>)[type] ?? type; }
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
  vote(answer: AppreciationAnswer): void {
    if (this.pendingVote() || answer.isOwn) return;
    this.pendingVote.set(answer.id);
    this.game.voteAppreciation(answer.id, !answer.voted).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.pendingVote.set(''))).subscribe({ next: () => this.load(this.currentPage()), error: () => this.error.set('投票尚未完成，請再試一次。') });
  }
}
