import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, interval, of, Subscription } from 'rxjs';

import {
  MiniGameArtifact,
  MiniGameComplete,
  MiniGameMode,
  MiniGameStart
} from './game.models';
import { GameNavigationComponent } from './game-navigation.component';
import { GameService } from './game.service';
import { CatalogService } from '../services/catalog-service';

type TrainingPhase = 'list' | 'playing' | 'complete';

interface MemoryCard {
  id: string;
  artifactId: string;
  name: string;
  image: string;
  revealed: boolean;
  matched: boolean;
}

interface CatalogHint {
  artifactId: string;
  name: string;
  description: string | null;
}

interface TrainingSessionSnapshot {
  attempt: MiniGameStart;
  elapsedSeconds: number;
  puzzleOrder: number[];
  puzzleSelection: number | null;
  restoreOrder: number[];
  restoreSelection: number | null;
  locatorChoice: string | null;
  matchedCardIds: string[];
}

@Component({
  selector: 'app-game-training',
  imports: [RouterLink, GameNavigationComponent],
  styleUrl: './game-training.component.scss',
  template: `
    <div class="training-notebook" [class.is-playing]="phase === 'playing'">
      <!-- ui-integration: 單人玩法與多人房間共用 Game 子導覽，並保留回到大廳的出口。 -->
      <app-game-navigation>
        <a class="training-nav-back" routerLink="/game">返回多人鑑定大廳</a>
      </app-game-navigation>

      <section class="chapter" aria-labelledby="training-title">
        <header class="chapter-heading">
          <div><p>單人挑戰</p><h1 id="training-title">單人小遊戲</h1><span>目前已開放的模式</span></div>
          @if (phase === 'list' && !authRequired && !loading) { <strong class="chapter-count"><small>可選模式</small>{{ modes.length }}</strong> }
        </header>

        @if (error && !authRequired) { <div class="message error" role="alert"><strong>單人小遊戲目前無法載入</strong><span>{{ error }}</span><div class="auth-actions"><button type="button" (click)="retryModes()">重新載入</button></div></div> }
        @if (loading) { <div class="loading" role="status">正在載入單人小遊戲…</div> }
        @else if (phase === 'complete') {
          @if (complete; as result) {
            <section class="result-sheet" aria-live="polite">
              <p class="kicker">本局完成</p>
              <h2>{{ result.grade }} 級 <span>{{ result.normalizedScore }} 分</span></h2>
              <p>點數 {{ result.pointReward }} · 鑰匙進度 +{{ result.keyProgressReward }}</p>
              @if (!result.economicRewardGranted) { <small>今日獎勵額度已用完，成績仍會保留。</small> }
              @if (attempt?.modeCode === 'DETAIL_LOCATOR' && attempt; as current) {
                <section class="locator-answer" aria-label="局部辨識答案" animate.enter="game-result-enter">
                  <img [src]="current.primaryImagePath || current.thumbnailPath" [alt]="current.artifactName" />
                  <div><strong>{{ result.rawScore === 100 ? '辨識正確' : '正確答案' }}</strong><p>{{ current.artifactName }}</p></div>
                </section>
              }
              <div class="result-actions"><button type="button" (click)="playAgain()">再玩一次</button><a routerLink="/game">返回多人鑑定大廳</a></div>
            </section>
          }
        }
        @else if (phase === 'list' && (authRequired || modes.length)) {
          <section class="training-list" [class.is-auth-gated]="authRequired">
          @if (authRequired) {
            <section class="auth-state" aria-labelledby="auth-state-title">
              <p class="kicker">開始前</p>
              <h2 id="auth-state-title">登入後即可開始遊玩</h2>
              <p>登入後會載入目前啟用的玩法，完成結果也會保留在會員紀錄。</p>
              <div class="auth-actions">
                <a routerLink="/login" [queryParams]="{ returnUrl: '/game/training' }">前往登入</a>
                <button type="button" (click)="retryModes()">重新載入</button>
              </div>
            </section>
          }
          <section class="training-hero" aria-labelledby="training-hero-title">
            <div class="training-hero-copy">
              <p class="training-hero-kicker">挑戰模式</p>
              <h2 id="training-hero-title">開始一局</h2>
              <p>完成後會立即結算成績與獎勵進度。</p>
            </div>
          </section>
          @if (!authRequired) {
            <ol class="mode-index">@for (mode of modes; track mode.id; let index = $index) { <li><b>{{ (index + 1).toString().padStart(2, '0') }}</b><div><h2>{{ mode.name }}</h2><p>{{ mode.description }}</p></div><button type="button" (click)="start(mode)" [disabled]="starting">{{ starting ? '準備中…' : '開始挑戰' }}</button></li> }</ol>
          }
          </section>
        }
        @else if (attempt; as current) {
          <section class="play-sheet" aria-live="polite">
            <header class="play-heading">
              <div class="play-heading__title"><p class="kicker">{{ current.modeName }}</p><h2>{{ current.modeCode === 'DETAIL_LOCATOR' ? '看局部辨識文物' : current.artifactName }}</h2></div>
              <div class="play-heading__meta">
                <span class="play-state"><span class="play-state__mark" aria-hidden="true">●</span>進行中</span>
                <span class="difficulty">{{ difficultyText(current.difficulty) }}</span>
              </div>
              <div class="play-heading__progress">
                <div class="play-heading__progress-meta"><span>完成比例</span><strong>{{ progressPercent }}%</strong></div>
                <div class="play-progress" role="progressbar" aria-label="目前完成比例" [attr.aria-valuenow]="progressPercent" aria-valuemin="0" aria-valuemax="100"><span [style.width.%]="progressPercent"></span></div>
                <small>已用時間 {{ elapsedLabel }}</small>
              </div>
            </header>

            @if (current.modeCode === 'MEMORY_MATCH') {
              <aside class="collection-hints" aria-label="隨機館藏提示">
                <header><span>館藏提示</span><small>隨機顯示 {{ memoryHints.length }} 件</small></header>
                <div class="collection-hints__grid">
                  @for (hint of memoryHints; track hint.artifactId) {
                    <article><strong>{{ hint.name }}</strong><p>{{ hint.description || '館藏說明整理中。' }}</p></article>
                  }
                </div>
              </aside>
            } @else if (current.modeCode !== 'DETAIL_LOCATOR' && currentArtifactHint; as hint) {
              <aside class="collection-hint" aria-label="館藏提示"><span>館藏提示</span><strong>{{ hint.name }}</strong><p>{{ hint.description || '館藏說明整理中。' }}</p></aside>
            }

            @if (current.modeCode === 'DETAIL_LOCATOR') {
              <div class="game-board locator-game">
                <div class="clue-image" role="img" aria-label="文物原圖的局部線索">
                  @if ((current.primaryImagePath || current.thumbnailPath) && !imageUnavailable) {
                    <img class="clue-image__zoom" [src]="current.primaryImagePath || current.thumbnailPath" alt="" [style.left.%]="50 - locatorCropX * 500" [style.top.%]="50 - locatorCropY * 500" (error)="imageUnavailable = true" />
                  } @else { <span class="image-fallback">圖片整理中<br /><small>請依可見線索作答</small></span> }
                  <span class="clue-image__badge">局部線索</span>
                </div>
                <div class="game-prompt">
                  <h3>從四件相似文物中找出原圖</h3>
                  <p>先觀察局部的器形與紋飾；完整原圖會在送出後揭曉。</p>
                  <div class="artifact-options artifact-options--text" role="group" aria-label="選擇最相近的文物">
                    @for (option of locatorOptions; track option.artifactId; let index = $index) {
                      <button type="button" [class.selected]="locatorChoice === option.artifactId" [attr.aria-pressed]="locatorChoice === option.artifactId" (click)="chooseLocator(option.artifactId)">
                        <span class="locator-option__index">{{ (index + 1).toString().padStart(2, '0') }}</span>
                        <span>{{ option.name }}</span>
                      </button>
                    }
                  </div>
                </div>
              </div>
            }
            @else if (current.modeCode === 'MEMORY_MATCH') {
              <div class="game-board memory-game"><div class="game-prompt"><h3>翻牌配對</h3><p>4×4 共 16 張牌，翻開兩張卡片找出相同文物，全部配對後再送出結果。</p></div><div class="memory-grid">@for (card of memoryCards; track card.id; let index = $index) { <button type="button" class="memory-card" [class.is-open]="card.revealed || card.matched" [class.is-matched]="card.matched" (click)="flipMemory(index)" [attr.aria-label]="card.revealed || card.matched ? card.name : '翻開卡片'">@if (card.revealed || card.matched) { @if (card.image && !imageFailed('memory-' + card.id)) { <img [src]="card.image" [alt]="card.name" (error)="markImageFailed('memory-' + card.id)" /> } @else { <span class="image-fallback" aria-hidden="true">文物</span> } } @else { <span>翻</span> }</button> }</div><p class="game-hint">已配對 {{ memoryMatched }} / {{ memoryPairCount }}</p></div>
            }
            @else if (current.modeCode === 'ARTIFACT_PUZZLE') {
              <div class="game-board ordering-game"><div class="game-prompt"><h3>館藏拼圖</h3><p>5×5 拼圖，點選兩塊交換位置，把畫面排回順序。</p></div><div class="tile-grid">@for (piece of puzzleOrder; track $index; let slot = $index) { <button type="button" class="image-tile" [class.selected]="puzzleSelection === slot" [attr.aria-pressed]="puzzleSelection === slot" [attr.aria-label]="'第 ' + (slot + 1) + ' 格拼圖'" (click)="swapPuzzle(slot)">@if ((current.primaryImagePath || current.thumbnailPath) && !imageFailed('puzzle')) { <img [src]="current.primaryImagePath || current.thumbnailPath" [alt]="current.artifactName + ' 拼圖第 ' + (piece + 1) + ' 塊'" [style.left.%]="pieceOffsetX(piece)" [style.top.%]="pieceOffsetY(piece)" (error)="markImageFailed('puzzle')" /> } @else { <span class="image-fallback" aria-hidden="true">館藏</span> }<b>{{ slot + 1 }}</b></button> }</div><p class="game-hint">{{ puzzleSelection === null ? '先選一塊拼圖' : '再選另一塊交換' }}</p></div>
            }
            @else {
              <div class="game-board ordering-game"><div class="game-prompt"><h3>長卷復位</h3><p>3×5 長卷，點選兩段交換位置，把完整畫面排回原貌。</p></div><div class="strip-row">@for (strip of restoreOrder; track $index; let slot = $index) { <button type="button" class="image-strip" [class.selected]="restoreSelection === slot" [attr.aria-pressed]="restoreSelection === slot" [attr.aria-label]="'第 ' + (slot + 1) + ' 格長卷'" (click)="swapRestore(slot)">@if ((current.primaryImagePath || current.thumbnailPath) && !imageFailed('restore')) { <img [src]="current.primaryImagePath || current.thumbnailPath" [alt]="current.artifactName + ' 長卷第 ' + (strip + 1) + ' 段'" [style.left.%]="stripOffsetX(strip)" [style.top.%]="stripOffsetY(strip)" (error)="markImageFailed('restore')" /> } @else { <span class="image-fallback" aria-hidden="true">長卷</span> }<b>{{ slot + 1 }}</b></button> }</div><p class="game-hint">{{ restoreSelection === null ? '先選一段長卷' : '再選另一段交換' }}</p></div>
            }

            <footer class="play-footer"><span class="progress-readout" aria-live="polite"><span class="progress-readout__label">目前進度</span><strong>{{ progressText }}</strong></span><div class="play-actions"><button type="button" class="secondary" (click)="exitAttempt()" [disabled]="completing">返回玩法列表</button><button type="button" (click)="completeAttempt()" [disabled]="!canComplete || completing">{{ completing ? '送出中…' : '送出結果' }}</button></div></footer>
          </section>
        }
        @else if (!error) { <div class="loading">目前沒有可開始的單人小遊戲。</div> }
      </section>
    </div>
  `,
})
export class GameTrainingComponent implements OnInit, OnDestroy {
  readonly game = inject(GameService);
  private readonly catalog = inject(CatalogService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  modes: MiniGameMode[] = [];
  attempt: MiniGameStart | null = null;
  complete: MiniGameComplete | null = null;
  phase: TrainingPhase = 'list';
  loading = false;
  starting = false;
  completing = false;
  authRequired = false;
  imageUnavailable = false;
  error = '';
  locatorChoice: string | null = null;
  puzzleOrder: number[] = [];
  puzzleSelection: number | null = null;
  restoreOrder: number[] = [];
  restoreSelection: number | null = null;
  memoryCards: MemoryCard[] = [];
  memoryHints: CatalogHint[] = [];
  private currentArtifactHintState: CatalogHint | null = null;
  private readonly failedImages = new Set<string>();
  memoryOpen: number[] = [];
  memoryMatched = 0;
  memoryBusy = false;
  elapsedSeconds = 0;
  locatorCropX = 0.5;
  locatorCropY = 0.5;
  private memoryTimer: ReturnType<typeof setTimeout> | null = null;
  private elapsedTimer: Subscription | null = null;
  private attemptStartedAt = 0;

  ngOnInit(): void {
    this.restoreSessionState();
    this.loadModes();
    this.elapsedTimer = interval(1000).subscribe(() => {
      if (this.phase !== 'playing' || !this.attemptStartedAt) return;
      this.elapsedSeconds = Math.max(0, Math.floor((Date.now() - this.attemptStartedAt) / 1000));
      this.persistSessionState();
      this.changeDetector.markForCheck();
    });
  }

  retryModes(): void { this.loadModes(); }

  private loadModes(): void {
    this.loading = true;
    this.authRequired = false;
    this.error = '';
    this.game.getMiniGameModes().pipe(finalize(() => { this.loading = false; this.changeDetector.markForCheck(); })).subscribe({
      next: (modes) => {
        this.modes = modes;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => { this.setError(error); this.changeDetector.markForCheck(); }
    });
  }

  ngOnDestroy(): void {
    if (this.memoryTimer !== null) clearTimeout(this.memoryTimer);
    this.elapsedTimer?.unsubscribe();
  }

  get locatorOptions(): MiniGameArtifact[] {
    const attempt = this.attempt;
    const pool = attempt?.artifactPool ?? [];
    if (!attempt || pool.length <= 4) return pool;

    const targetIndex = pool.findIndex((artifact) => artifact.artifactId === attempt.artifactId);
    return targetIndex >= 4 ? [...pool.slice(0, 3), pool[targetIndex]] : pool.slice(0, 4);
  }

  get memoryPairCount(): number { return Math.floor(this.memoryCards.length / 2); }

  get currentArtifactHint(): CatalogHint | null { return this.currentArtifactHintState; }

  get progressPercent(): number {
    if (!this.attempt) return 0;
    switch (this.attempt.modeCode) {
      case 'DETAIL_LOCATOR': return this.locatorChoice ? 100 : 0;
      case 'MEMORY_MATCH': return this.memoryPairCount ? Math.round((this.memoryMatched / this.memoryPairCount) * 100) : 0;
      case 'ARTIFACT_PUZZLE': return this.orderScore(this.puzzleOrder);
      default: return this.orderScore(this.restoreOrder);
    }
  }

  get elapsedLabel(): string {
    const minutes = Math.floor(this.elapsedSeconds / 60).toString().padStart(2, '0');
    const seconds = (this.elapsedSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  imageFailed(key: string): boolean { return this.failedImages.has(key); }

  markImageFailed(key: string): void {
    this.failedImages.add(key);
    this.changeDetector.markForCheck();
  }

  get canComplete(): boolean {
    if (!this.attempt || this.phase !== 'playing') return false;
    switch (this.attempt.modeCode) {
      case 'DETAIL_LOCATOR': return this.locatorChoice !== null;
      case 'MEMORY_MATCH': return this.memoryPairCount > 0 && this.memoryMatched === this.memoryPairCount;
      case 'ARTIFACT_PUZZLE': return this.isSolved(this.puzzleOrder);
      default: return this.isSolved(this.restoreOrder);
    }
  }

  get progressText(): string {
    if (!this.attempt) return '';
    switch (this.attempt.modeCode) {
      case 'DETAIL_LOCATOR': return this.locatorChoice ? '已選定答案' : '尚未選答案';
      case 'MEMORY_MATCH': return `已配對 ${this.memoryMatched} / ${this.memoryPairCount}`;
      case 'ARTIFACT_PUZZLE': return this.isSolved(this.puzzleOrder) ? '拼圖完成' : '交換 25 塊拼圖直到完成';
      default: return this.isSolved(this.restoreOrder) ? '長卷完成' : '交換 15 段長卷直到完成';
    }
  }

  difficultyText(difficulty: string): string {
    return { EASY: '簡單', NORMAL: '一般', HARD: '困難', EXPERT: '專家' }[difficulty.trim().toUpperCase()] ?? difficulty;
  }

  start(mode: MiniGameMode): void {
    this.starting = true;
    this.error = '';
    this.game.startMiniGame(mode.code).pipe(finalize(() => { this.starting = false; this.changeDetector.markForCheck(); })).subscribe({
      next: (attempt) => { this.beginAttempt(attempt); this.changeDetector.markForCheck(); },
      error: (error: unknown) => { this.setError(error); this.changeDetector.markForCheck(); }
    });
  }

  chooseLocator(artifactId: string): void {
    if (this.phase !== 'playing') return;
    this.locatorChoice = artifactId;
    this.persistSessionState();
  }

  swapPuzzle(slot: number): void {
    if (this.puzzleSelection === null) { this.puzzleSelection = slot; this.persistSessionState(); return; }
    if (this.puzzleSelection === slot) { this.puzzleSelection = null; this.persistSessionState(); return; }
    this.swap(this.puzzleOrder, this.puzzleSelection, slot);
    this.puzzleSelection = null;
    this.persistSessionState();
  }

  swapRestore(slot: number): void {
    if (this.restoreSelection === null) { this.restoreSelection = slot; this.persistSessionState(); return; }
    if (this.restoreSelection === slot) { this.restoreSelection = null; this.persistSessionState(); return; }
    this.swap(this.restoreOrder, this.restoreSelection, slot);
    this.restoreSelection = null;
    this.persistSessionState();
  }

  flipMemory(index: number): void {
    if (this.phase !== 'playing' || this.memoryBusy) return;
    const card = this.memoryCards[index];
    if (!card || card.revealed || card.matched) return;
    card.revealed = true;
    this.memoryOpen = [...this.memoryOpen, index];
    if (this.memoryOpen.length < 2) { this.persistSessionState(); return; }
    const [firstIndex, secondIndex] = this.memoryOpen;
    const first = this.memoryCards[firstIndex];
    const second = this.memoryCards[secondIndex];
    this.memoryBusy = true;
    this.memoryTimer = setTimeout(() => {
      if (first.artifactId === second.artifactId) {
        first.matched = true;
        second.matched = true;
        this.memoryMatched += 1;
      } else {
        first.revealed = false;
        second.revealed = false;
      }
      this.memoryOpen = [];
      this.memoryBusy = false;
      this.memoryTimer = null;
      this.persistSessionState();
      this.changeDetector.markForCheck();
    }, 650);
  }

  completeAttempt(): void {
    if (!this.attempt || !this.canComplete) return;
    this.completing = true;
    this.error = '';
    const rawScore = this.score();
    this.game.completeMiniGame(this.attempt.attemptId, {
      rawScore,
      rawResultJson: JSON.stringify(this.resultPayload(rawScore))
    }).pipe(finalize(() => { this.completing = false; this.changeDetector.markForCheck(); })).subscribe({
      next: (result) => { this.complete = result; this.phase = 'complete'; this.clearSessionState(); this.scrollToTop(); this.changeDetector.markForCheck(); },
      error: (error: unknown) => { this.setError(error); this.changeDetector.markForCheck(); }
    });
  }

  exitAttempt(): void {
    if (!this.attempt || this.completing) return;
    // ui-integration: 小遊戲沒有既有取消 API，離開前明確告知進度不會送出，避免玩家誤以為結果已保存。
    if (!window.confirm('確定要離開這次挑戰嗎？目前進度不會送出。')) return;
    this.attempt = null;
    this.complete = null;
    this.phase = 'list';
    this.resetBoard();
    this.error = '';
    this.clearSessionState();
    this.scrollToTop();
  }

  playAgain(): void {
    this.attempt = null;
    this.complete = null;
    this.phase = 'list';
    this.resetBoard();
    this.error = '';
    this.clearSessionState();
    this.scrollToTop();
  }

  pieceOffsetX(piece: number): number { return -(piece % 5) * 100; }
  pieceOffsetY(piece: number): number { return -Math.floor(piece / 5) * 100; }
  stripOffsetX(strip: number): number { return -(strip % 5) * 100; }
  stripOffsetY(strip: number): number { return -Math.floor(strip / 5) * 100; }

  private beginAttempt(attempt: MiniGameStart): void {
    this.attempt = attempt;
    this.complete = null;
    this.phase = 'playing';
    this.attemptStartedAt = Date.now();
    this.elapsedSeconds = 0;
    this.memoryHints = [];
    this.currentArtifactHintState = null;
    this.imageUnavailable = false;
    this.setLocatorCrop(attempt.seed);
    this.resetBoard();
    this.loadCatalogHints(attempt);
    this.persistSessionState();
    this.scrollToTop();
  }

  private restoreSessionState(): void {
    const raw = this.readSessionState();
    if (!raw || !this.isValidAttempt(raw.attempt)) return;

    this.attempt = raw.attempt;
    this.complete = null;
    this.phase = 'playing';
    this.attemptStartedAt = Date.now() - Math.max(0, raw.elapsedSeconds) * 1000;
    this.elapsedSeconds = Math.max(0, raw.elapsedSeconds);
    this.imageUnavailable = false;
    this.setLocatorCrop(this.attempt.seed);
    this.resetBoard();
    if (this.attempt.modeCode === 'ARTIFACT_PUZZLE' && this.isPermutation(raw.puzzleOrder, 25)) {
      this.puzzleOrder = raw.puzzleOrder;
      this.puzzleSelection = this.validSlot(raw.puzzleSelection, 25);
    }
    if (this.attempt.modeCode === 'STRIP_RESTORE' && this.isPermutation(raw.restoreOrder, 15)) {
      this.restoreOrder = raw.restoreOrder;
      this.restoreSelection = this.validSlot(raw.restoreSelection, 15);
    }
    if (this.attempt.modeCode === 'DETAIL_LOCATOR') this.locatorChoice = raw.locatorChoice;
    if (this.attempt.modeCode === 'MEMORY_MATCH') {
      const matched = new Set(raw.matchedCardIds);
      this.memoryCards.forEach((card) => { card.matched = matched.has(card.id); });
      this.memoryMatched = this.memoryCards.filter((card) => card.matched).length / 2;
    }
    this.loadCatalogHints(this.attempt);
  }

  private persistSessionState(): void {
    if (this.phase !== 'playing' || !this.attempt) return;
    const snapshot: TrainingSessionSnapshot = {
      attempt: this.attempt,
      elapsedSeconds: this.elapsedSeconds,
      puzzleOrder: this.puzzleOrder,
      puzzleSelection: this.puzzleSelection,
      restoreOrder: this.restoreOrder,
      restoreSelection: this.restoreSelection,
      locatorChoice: this.locatorChoice,
      matchedCardIds: this.memoryCards.filter((card) => card.matched).map((card) => card.id)
    };
    try { sessionStorage.setItem('qmah-mini-game-session-v1', JSON.stringify(snapshot)); } catch { /* private mode/storage quota: gameplay remains usable */ }
  }

  private clearSessionState(): void {
    try { sessionStorage.removeItem('qmah-mini-game-session-v1'); } catch { /* storage is optional */ }
  }

  private readSessionState(): TrainingSessionSnapshot | null {
    try {
      const raw = sessionStorage.getItem('qmah-mini-game-session-v1');
      return raw ? JSON.parse(raw) as TrainingSessionSnapshot : null;
    } catch { return null; }
  }

  private isValidAttempt(value: unknown): value is MiniGameStart {
    if (!value || typeof value !== 'object') return false;
    const attempt = value as Partial<MiniGameStart>;
    return typeof attempt.attemptId === 'string' && typeof attempt.modeCode === 'string' && Array.isArray(attempt.artifactPool);
  }

  private isPermutation(order: number[], length: number): boolean {
    return Array.isArray(order) && order.length === length && new Set(order).size === length && order.every((value) => Number.isInteger(value) && value >= 0 && value < length);
  }

  private validSlot(slot: number | null, length: number): number | null {
    return typeof slot === 'number' && Number.isInteger(slot) && slot >= 0 && slot < length ? slot : null;
  }

  private loadCatalogHints(attempt: MiniGameStart): void {
    if (attempt.modeCode === 'DETAIL_LOCATOR') return;
    const fallback = this.fallbackArtifact(attempt);
    const pool = attempt.artifactPool.length ? attempt.artifactPool : [fallback];
    const candidates = attempt.modeCode === 'MEMORY_MATCH'
      ? this.shuffle(pool, `${attempt.seed}-catalog-hints`).slice(0, 5)
      : [pool.find((artifact) => artifact.artifactId === attempt.artifactId) ?? fallback];
    const details = candidates.map((candidate) => this.catalog.getArtifactById(candidate.artifactId).pipe(catchError(() => of(null))));

    forkJoin(details).subscribe((results) => {
      const hints = candidates.map((candidate, index) => ({
        artifactId: candidate.artifactId,
        name: results[index]?.name ?? candidate.name,
        description: results[index]?.description?.trim() || null
      }));
      this.memoryHints = hints;
      this.currentArtifactHintState = hints.find((hint) => hint.artifactId === attempt.artifactId) ?? null;
      this.changeDetector.markForCheck();
    });
  }

  private resetBoard(): void {
    this.failedImages.clear();
    this.locatorChoice = null;
    this.puzzleOrder = this.shuffle(Array.from({ length: 25 }, (_, index) => index), this.attempt?.seed ?? 'puzzle');
    this.puzzleSelection = null;
    this.restoreOrder = this.shuffle(Array.from({ length: 15 }, (_, index) => index), `${this.attempt?.seed ?? 'restore'}-restore`);
    this.restoreSelection = null;
    this.memoryOpen = [];
    this.memoryMatched = 0;
    this.memoryBusy = false;
    if (this.memoryTimer !== null) clearTimeout(this.memoryTimer);
    this.memoryTimer = null;
    const pool = this.attempt?.artifactPool.length ? this.attempt.artifactPool : this.attempt ? [this.fallbackArtifact(this.attempt)] : [];
    const source = pool.length ? pool.slice(0, Math.min(pool.length, 8)) : [];
    this.memoryCards = this.shuffle(source.flatMap((artifact) => [0, 1].map((copy) => ({
      id: `${artifact.artifactId}-${copy}`,
      artifactId: artifact.artifactId,
      name: artifact.name,
      image: artifact.thumbnailPath || artifact.primaryImagePath,
      revealed: false,
      matched: false
    }))), `${this.attempt?.seed ?? 'memory'}-memory`);
  }

  private score(): number {
    if (!this.attempt) return 0;
    switch (this.attempt.modeCode) {
      case 'DETAIL_LOCATOR': return this.locatorChoice === this.attempt.artifactId ? 100 : 25;
      case 'MEMORY_MATCH': return this.memoryPairCount ? Math.round((this.memoryMatched / this.memoryPairCount) * 100) : 0;
      case 'ARTIFACT_PUZZLE': return this.orderScore(this.puzzleOrder);
      default: return this.orderScore(this.restoreOrder);
    }
  }

  private resultPayload(rawScore: number): Record<string, unknown> {
    return {
      modeCode: this.attempt?.modeCode,
      artifactId: this.attempt?.artifactId,
      rawScore,
      locatorChoice: this.locatorChoice,
      puzzleOrder: this.puzzleOrder,
      restoreOrder: this.restoreOrder,
      memoryMatched: this.memoryMatched,
      memoryPairs: this.memoryPairCount
    };
  }

  private orderScore(order: number[]): number {
    if (!order.length) return 0;
    return Math.round((order.filter((piece, index) => piece === index).length / order.length) * 100);
  }

  private isSolved(order: number[]): boolean { return order.length > 0 && order.every((piece, index) => piece === index); }

  private swap(order: number[], first: number, second: number): void {
    [order[first], order[second]] = [order[second], order[first]];
  }

  private shuffle<T>(items: T[], seed: string): T[] {
    const result = [...items];
    let value = 0;
    for (const character of seed) value = (value * 31 + character.charCodeAt(0)) | 0;
    for (let index = result.length - 1; index > 0; index -= 1) {
      value = (value * 1664525 + 1013904223) | 0;
      const target = Math.abs(value) % (index + 1);
      [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
  }

  private fallbackArtifact(attempt: MiniGameStart): MiniGameArtifact {
    return { artifactId: attempt.artifactId, name: attempt.artifactName, primaryImagePath: attempt.primaryImagePath, thumbnailPath: attempt.thumbnailPath };
  }

  private setLocatorCrop(seed: string): void {
    const focusPoints = [0.4, 0.45, 0.5, 0.55, 0.6];
    this.locatorCropX = this.shuffle(focusPoints, `${seed}-locator-x`)[0];
    this.locatorCropY = this.shuffle(focusPoints, `${seed}-locator-y`)[0];
  }

  private setError(error: unknown): void {
    this.authRequired = error instanceof HttpErrorResponse && error.status === 401;
    // ui-integration: Game 全區共用正式會員登入；避免登入入口與訓練頁各自維護不同帳號概念。
    this.error = this.authRequired ? '請先登入會員帳號，再開始或繼續小遊戲。' : this.game.errorMessage(error);
  }

  private scrollToTop(): void {
    // ui-integration: 狀態由列表切到遊玩或結算時，將視線帶回遊戲標題，避免沿用列表捲動位置造成流程斷裂。
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  }
}
