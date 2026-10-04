import { GameAudio } from './game-audio.service';
import { GameAudioToggleComponent } from './game-audio-toggle.component';
import { ChangeDetectorRef, Component, DestroyRef, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MeApiService } from '../core/services/me-api';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, interval, of, Subscription } from 'rxjs';

import {
  MiniGameArtifact,
  MiniGameComplete,
  MiniGameMode,
  MiniGameStart
} from './game.models';
import { GameService } from './game.service';
import { GameFontsDirective } from './game-fonts.directive';
import { GameTrainingModePickerComponent } from './game-training-mode-picker.component';
import { GameTrainingPlaySheetComponent, TrainingCatalogHint, TrainingMemoryCard } from './game-training-play-sheet.component';
import { GameTrainingResultComponent } from './game-training-result.component';
import { GameScrollPanelComponent } from './game-scroll-panel.component';
import { CatalogService } from '../services/catalog-service';
import { GameFocusMode } from '../core/services/game-focus-mode';
import { GameNavigationComponent } from './game-navigation.component';

import { LocatorAnswer, locatorCorrect, validLocatorAnswer } from './game-detail-locator';

type TrainingPhase = 'list' | 'playing' | 'complete';

interface TrainingSessionSnapshot {
  ownerId?: string;
  pendingResult?: { rawScore: number; rawResultJson: string };
  puzzleHintRegion?: number | null;
  restoreHintRegion?: number | null;
  attempt: MiniGameStart;
  elapsedSeconds: number;
  puzzleOrder: number[];
  puzzleSelection: number | null;
  restoreOrder: number[];
  restoreSelection: number | null;
  locatorChoice?: string | null;
  locatorAnswers?: LocatorAnswer[];
  locatorAssistedIds?: string[];
  matchedCardIds: string[];
  moves?: number;
  hintsUsed?: number;
  autoPlaced?: number;
  hintedArtifactIds?: string[];
  locatorExcludedIds?: string[];
}

@Component({
  selector: 'app-game-training',
  hostDirectives: [GameFontsDirective],
  imports: [RouterLink, GameNavigationComponent, GameTrainingModePickerComponent, GameTrainingPlaySheetComponent, GameTrainingResultComponent, GameScrollPanelComponent, GameAudioToggleComponent],
  styleUrl: './game-training.component.scss',
  templateUrl: './game-training.component.html',
})
export class GameTrainingComponent implements OnInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  private readonly audio = (() => { const audio = inject(GameAudio); this.destroyRef.onDestroy(audio.attach()); this.destroyRef.onDestroy(() => this.releaseScene?.()); return audio; })();
  private readonly meApi = inject(MeApiService);
  private ownerId = '';
  private pendingResult: { rawScore: number; rawResultJson: string } | null = null;
  puzzleHintRegion: number | null = null;
  restoreHintRegion: number | null = null;
  readonly game = inject(GameService);
  readonly focusMode = inject(GameFocusMode);
  private readonly catalog = inject(CatalogService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  modes: MiniGameMode[] = [];
  selectedModeCode = inject(ActivatedRoute).snapshot.queryParamMap.get('game') ?? '';
  paused = false;
  confirmLeaving = false;
  helpRequested = false;
  private readonly hintedArtifacts = new Set<string>();
  locatorExcludedIds: string[] = [];
  @ViewChild(GameTrainingPlaySheetComponent) protected playSheet?: GameTrainingPlaySheetComponent;
  get helpUnits(): number { return this.attempt?.modeCode === 'MEMORY_MATCH' ? this.memoryPairCount : this.attempt?.modeCode === 'ARTIFACT_PUZZLE' ? 25 : this.attempt?.modeCode === 'STRIP_RESTORE' ? 15 : this.locatorOptions.length; }
  get helpRemaining(): number {
    switch (this.attempt?.modeCode) {
      case 'MEMORY_MATCH': return this.memoryPairCount - this.memoryMatched;
      case 'ARTIFACT_PUZZLE': return this.puzzleOrder.filter((piece, slot) => piece !== slot).length;
      case 'STRIP_RESTORE': return this.restoreOrder.filter((piece, slot) => piece !== slot).length;
      default: return this.locatorOptions.length - this.locatorAnswers.length - this.locatorAssistedIds.length;
    }
  }
  get helpPenalty(): number {
    // 輔助扣分按累計數量進位，顯示本次增加的差額，避免分次使用時多顯示一分。
    const units = Math.max(1, this.helpUnits);
    return Math.ceil(60 * (this.autoPlaced + this.helpRemaining) / units) - Math.ceil(60 * this.autoPlaced / units);
  }
  get hintPenalty(): number { return this.attempt?.modeCode === 'DETAIL_LOCATOR' ? 10 : 3; }
  get canAskForHelp(): boolean {
    if (this.phase !== 'playing' || this.completing || this.pendingResult || this.memoryBusy || this.helpRemaining <= 0) return false;
    if (this.attempt?.modeCode === 'ARTIFACT_PUZZLE') return !!this.playSheet?.puzzleReady() && !this.imageFailed('puzzle');
    if (this.attempt?.modeCode === 'STRIP_RESTORE') return !!this.playSheet?.scrollReady() && this.playSheet.scrollEligible();
    return !this.imageUnavailable;
  }
  get locatorHintArtifactId(): string | null {
    const artifact = this.locatorOptions[this.locatorAnswers.length];
    return artifact && this.hintedArtifacts.has(artifact.artifactId) ? artifact.artifactId : null;
  }
  get canRequestHint(): boolean { return this.canAskForHelp && (this.attempt?.modeCode !== 'DETAIL_LOCATOR' || !this.locatorHintArtifactId); }
  useHelp(automatic: boolean): void {
    if (!this.canAskForHelp || (!automatic && !this.canRequestHint)) return;
    this.closePause();
    this.resumeFromPause();
    if (this.attempt?.modeCode === 'ARTIFACT_PUZZLE') {
      this.playSheet?.requestPuzzleHelp(automatic);
    } else if (this.attempt?.modeCode === 'STRIP_RESTORE') {
      this.playSheet?.requestScrollHelp(automatic);
    } else if (this.attempt?.modeCode === 'MEMORY_MATCH') {
      if (automatic) {
        this.autoPlaced += this.helpRemaining;
        this.memoryCards = this.memoryCards.map(card => ({ ...card, matched: true, revealed: true }));
        this.memoryMatched = this.memoryPairCount;
        this.memoryOpen = [];
        this.memoryFeedback = '剩餘配對已代完成，正在送出結果。';
      } else {
        const card = this.memoryCards.find(card => !card.matched);
        if (!card) return;
        if (!this.hintedArtifacts.has(card.artifactId)) {
          this.hintedArtifacts.add(card.artifactId);
          this.hintsUsed++;
        }
        const positions = this.memoryCards.flatMap((candidate, index) => candidate.artifactId === card.artifactId ? [index + 1] : []);
        this.memoryFeedback = `第 ${positions[0]} 張與第 ${positions[1]} 張是同一件文物。這組提示扣 3 分，重看不再扣分。`;
      }
    } else if (this.attempt) {
      if (automatic) {
        const remaining = this.locatorOptions.slice(this.locatorAnswers.length);
        this.autoPlaced += remaining.length;
        this.locatorAssistedIds = remaining.map(artifact => artifact.artifactId);
      } else {
        const artifact = this.locatorOptions[this.locatorAnswers.length];
        if (!artifact || this.hintedArtifacts.has(artifact.artifactId)) return;
        this.hintedArtifacts.add(artifact.artifactId);
        this.hintsUsed++;
      }
    }
    this.persistSessionState();
    this.changeDetector.markForCheck();
    if (automatic) this.completeAttempt();
  }
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);
  private pausedAt = 0;
  @ViewChild('pauseDialog') private pauseDialog?: ElementRef<HTMLDialogElement>;
  get selectedMode(): MiniGameMode | null { return this.modes.find(mode => mode.code === this.selectedModeCode) ?? this.modes[0] ?? null; }
  selectMode(code: string): void { if (!this.starting) this.selectedModeCode = code; }
  openPause(): void {
    if (this.phase !== 'playing' || this.paused || this.completing || !this.pauseDialog || document.querySelector('dialog[open]')) return;
    this.paused = true;
    this.pausedAt = Date.now();
    this.persistSessionState();
    if (this.memoryTimer !== null) { clearTimeout(this.memoryTimer); this.memoryTimer = null; }
    this.pauseDialog.nativeElement.showModal();
  }
  closePause(): void { this.pauseDialog?.nativeElement.close(); }
  resumeFromPause(): void {
    const restoreFocus = this.paused;
    if (this.paused) this.attemptStartedAt += Date.now() - this.pausedAt;
    this.paused = false;
    this.confirmLeaving = false;
    this.helpRequested = false;
    if (this.pendingMemoryPair && this.memoryTimer === null) this.memoryTimer = setTimeout(this.pendingMemoryPair, 650);
    this.changeDetector.markForCheck();
    if (restoreFocus) requestAnimationFrame(() => {
      if (this.hostElement.nativeElement.isConnected && this.phase === 'playing' && !this.paused) this.hostElement.nativeElement.querySelector<HTMLButtonElement>('.pause-trigger')?.focus({ preventScroll: true });
    });
  }

  @HostListener('document:keydown', ['$event'])
  handlePauseKey(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || this.phase !== 'playing' || this.paused || document.querySelector('dialog[open]')) return;
    event.preventDefault();
    this.openPause();
  }

  @HostListener('document:visibilitychange')
  pauseWhenHidden(): void { if (document.hidden && this.phase === 'playing' && !this.paused) this.openPause(); }

  moveBoardFocus(event: KeyboardEvent, slot: number, columns: number): void {
    const buttons = Array.from((event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLButtonElement>('button') ?? []);
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };
    if (!(event.key in delta) && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const step = event.key === 'Home' ? 1 : event.key === 'End' ? -1 : delta[event.key as keyof typeof delta];
    let next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : slot + step;
    while (next >= 0 && next < buttons.length) {
      if (['ArrowLeft', 'ArrowRight'].includes(event.key) && Math.floor(next / columns) !== Math.floor(slot / columns)) break;
      if (!buttons[next].disabled) { buttons[next].focus(); break; }
      next += step;
    }
  }

  leaveFromPause(): void {
    if (!this.confirmLeaving) { this.confirmLeaving = true; return; }
    this.exitAttempt();
    if (this.phase === 'list') this.closePause();
  }
  attempt: MiniGameStart | null = null;
  complete: MiniGameComplete | null = null;
  private currentPhase: TrainingPhase = 'list';
  private releaseScene: (() => void) | null = null;
  // 挑戰進行中換成牌桌那首音樂，其餘時候用選單那首
  get phase(): TrainingPhase { return this.currentPhase; }
  set phase(value: TrainingPhase) {
    this.currentPhase = value;
    this.releaseScene?.();
    this.releaseScene = value === 'playing' ? this.audio.useScene('play') : null;
  }
  loading = false;
  starting = false;
  completing = false;
  authRequired = false;
  imageUnavailable = false;
  error = '';
  locatorAnswers: LocatorAnswer[] = [];
  locatorAssistedIds: string[] = [];
  puzzleOrder: number[] = [];
  puzzleSelection: number | null = null;
  restoreOrder: number[] = [];
  restoreSelection: number | null = null;
  memoryCards: TrainingMemoryCard[] = [];
  memoryHints: TrainingCatalogHint[] = [];
  private currentArtifactHintState: TrainingCatalogHint | null = null;
  private readonly failedImages = new Set<string>();
  failedImageKeys: string[] = [];
  memoryOpen: number[] = [];
  memoryMatched = 0;
  memoryBusy = false;
  memoryFeedback = '翻開一張牌，記住文物與位置。';
  elapsedSeconds = 0;
  moves = 0;
  hintsUsed = 0;
  autoPlaced = 0;
  locatorCropX = 0.5;
  locatorCropY = 0.5;
  private memoryTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingMemoryPair: (() => void) | null = null;
  private elapsedTimer: Subscription | null = null;
  private attemptStartedAt = 0;

  ngOnInit(): void {
    this.meApi.getMe().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: me => { this.ownerId = me.id; this.restoreSessionState(); this.loadModes(); },
      error: () => this.loadModes()
    });
    let lastTick = Date.now();
    this.elapsedTimer = interval(1000).subscribe(() => {
      const now = Date.now(), delta = now - lastTick;
      lastTick = now;
      if (this.phase !== 'playing' || this.paused || !this.attemptStartedAt) return;
      if (this.pendingResult || this.completing || document.hidden || document.querySelector('dialog[open]')) {
        this.attemptStartedAt += delta;
        return;
      }
      this.elapsedSeconds = Math.max(0, Math.floor((Date.now() - this.attemptStartedAt) / 1000));
      this.persistSessionState();
      this.changeDetector.markForCheck();
    });
  }

  retryModes(): void { this.loadModes(); }

  retryAction(): void {
    if (this.phase === 'complete') this.playAgain();
    else if (this.phase === 'playing' && this.canComplete) this.completeAttempt();
    else this.loadModes();
  }

  retryImages(): void {
    this.failedImages.clear();
    this.syncFailedImageKeys();
    this.imageUnavailable = false;
  }

  setScrollAvailability(available: boolean): void {
    if (available) this.failedImages.delete('restore');
    else this.failedImages.add('restore');
    this.syncFailedImageKeys();
  }

  setPuzzleAvailability(available: boolean): void {
    if (available) this.failedImages.delete('puzzle');
    else this.failedImages.add('puzzle');
    this.syncFailedImageKeys();
    this.changeDetector.markForCheck();
  }

  get isPuzzleSolved(): boolean { return this.isSolved(this.puzzleOrder); }
  get isRestoreSolved(): boolean { return this.isSolved(this.restoreOrder); }

  get resultArtifacts(): MiniGameArtifact[] {
    if (!this.attempt) return [];
    if (this.attempt.modeCode === 'DETAIL_LOCATOR') return this.locatorOptions;
    if (this.attempt.modeCode !== 'MEMORY_MATCH') return [this.fallbackArtifact(this.attempt)];
    const ids = new Set(this.memoryCards.map(card => card.artifactId));
    return this.attempt.artifactPool.filter(artifact => ids.has(artifact.artifactId));
  }

  get resultTitle(): string {
    if (this.attempt?.modeCode === 'DETAIL_LOCATOR') return this.complete?.rawScore === 100 ? '四處細節，都找到了！' : '本輪定位完成，再挑戰一次吧';
    if (this.attempt?.modeCode === 'MEMORY_MATCH') return `${this.memoryPairCount} 組文物，都找到了`;
    return this.attempt?.modeCode === 'STRIP_RESTORE' ? '筆墨接上了，書畫復位完成' : '最後一塊到位，拼圖完成';
  }

  private loadModes(): void {
    this.loading = true;
    this.authRequired = false;
    this.error = '';
    this.game.getMiniGameModes().pipe(finalize(() => { this.loading = false; this.changeDetector.markForCheck(); })).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (modes) => {
        this.modes = modes;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => { this.setError(error); this.changeDetector.markForCheck(); }
    });
  }

  ngOnDestroy(): void {
    // 專注模式跨頁保持；離開遊戲區時由版面統一關閉
    this.stopAttemptTimers();
  }

  protected stopAttemptTimers(): void {
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

  get currentArtifactHint(): TrainingCatalogHint | null { return this.currentArtifactHintState; }

  get progressPercent(): number {
    if (!this.attempt) return 0;
    switch (this.attempt.modeCode) {
      case 'DETAIL_LOCATOR': return this.locatorOptions.length ? Math.round((this.locatorAnswers.length + this.locatorAssistedIds.length) / this.locatorOptions.length * 100) : 0;
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
    this.syncFailedImageKeys();
    this.changeDetector.markForCheck();
  }

  private syncFailedImageKeys(): void { this.failedImageKeys = [...this.failedImages]; }

  get canComplete(): boolean {
    if (!this.attempt || this.phase !== 'playing') return false;
    if (this.pendingResult) return true;
    switch (this.attempt.modeCode) {
      case 'DETAIL_LOCATOR': return this.locatorOptions.length === 4 && this.locatorAnswers.length + this.locatorAssistedIds.length === 4 && !this.imageUnavailable;
      case 'MEMORY_MATCH': return this.memoryPairCount > 0 && this.memoryMatched === this.memoryPairCount;
      case 'ARTIFACT_PUZZLE': return this.isSolved(this.puzzleOrder) && !!this.playSheet?.puzzleReady() && !this.imageFailed('puzzle');
      default: return this.isSolved(this.restoreOrder) && !!this.playSheet?.scrollReady() && this.playSheet.scrollEligible() && !this.imageFailed('restore');
    }
  }

  get progressText(): string {
    if (!this.attempt) return '';
    switch (this.attempt.modeCode) {
      case 'DETAIL_LOCATOR': return `定位 ${this.locatorAnswers.length} / ${this.locatorOptions.length} 件文物`;
      case 'MEMORY_MATCH': return `已配對 ${this.memoryMatched} / ${this.memoryPairCount}`;
      case 'ARTIFACT_PUZZLE': return this.isSolved(this.puzzleOrder) ? '拼圖完成' : '拖曳碎片到目標格，可依完成比例調整';
      default: return this.isSolved(this.restoreOrder) ? '長卷完成' : '三選一，把長卷接起來';
    }
  }

  difficultyText(difficulty: string): string {
    return { EASY: '簡單', NORMAL: '一般', HARD: '困難', EXPERT: '專家' }[difficulty?.trim().toUpperCase()] ?? '一般';
  }

  start(mode: Pick<MiniGameMode, 'code'>): void {
    if (this.starting || this.completing) return;
    this.starting = true;
    this.error = '';
    this.game.startMiniGame(mode.code).pipe(finalize(() => { this.starting = false; this.changeDetector.markForCheck(); })).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (attempt) => { this.beginAttempt(attempt); this.changeDetector.markForCheck(); },
      error: (error: unknown) => { this.setError(error); this.changeDetector.markForCheck(); }
    });
  }

  locateDetail(answer: LocatorAnswer): void {
    if (this.phase !== 'playing' || this.paused || this.resultFrozen || this.completing || this.imageUnavailable || !validLocatorAnswer(answer)) return;
    if (this.locatorOptions[this.locatorAnswers.length]?.artifactId !== answer.artifactId) return;
    this.locatorAnswers = [...this.locatorAnswers, answer];
    this.moves++;
    this.persistSessionState();
  }
  updatePlacement(kind: 'puzzle' | 'restore', order: number[]): void {
    if (this.phase !== 'playing' || this.paused || this.completing) return;
    if (kind === 'puzzle') this.puzzleOrder = order;
    else this.restoreOrder = order;
    this.persistSessionState();
  }

  recordPlacement(): void { this.moves++; this.persistSessionState(); }
  recordHint(): void { this.hintsUsed++; this.persistSessionState(); }
  recordAuto(count: number): void { this.autoPlaced += count; this.persistSessionState(); }

  flipMemory(index: number): void {
    if (this.phase !== 'playing' || this.paused || this.resultFrozen || this.memoryBusy || this.completing) return;
    const card = this.memoryCards[index];
    if (!card || card.revealed || card.matched) return;
    card.revealed = true;
    this.audio.play('flip');
    this.memoryCards = [...this.memoryCards];
    this.memoryFeedback = '再翻一張，找出相同文物。';
    this.memoryOpen = [...this.memoryOpen, index];
    if (this.memoryOpen.length < 2) { this.persistSessionState(); return; }
    const [firstIndex, secondIndex] = this.memoryOpen;
    this.moves += 1;
    const first = this.memoryCards[firstIndex];
    const second = this.memoryCards[secondIndex];
    const focusedCard = document.activeElement;
    const restoreKeyboardFocus = focusedCard?.classList.contains('memory-card');
    this.memoryBusy = true;
    this.pendingMemoryPair = () => {
      if (first.artifactId === second.artifactId) {
        first.matched = true;
        second.matched = true;
        this.memoryMatched += 1;
        this.audio.play('success');
        this.memoryFeedback = this.memoryMatched === this.memoryPairCount
          ? '全部配對完成，可以送出結果。'
          : `找到 ${first.name}！繼續尋找下一組。`;
      } else {
        first.revealed = false;
        second.revealed = false;
        this.memoryFeedback = '這兩張不同，記住位置後再試一次。';
      }
      this.memoryCards = [...this.memoryCards];
      this.memoryOpen = [];
      this.memoryBusy = false;
      this.memoryTimer = null;
      this.pendingMemoryPair = null;
      this.persistSessionState();
      this.changeDetector.markForCheck();
      if (restoreKeyboardFocus) requestAnimationFrame(() => {
        // 配對後原卡片會禁用，將鍵盤焦點留在盤面，避免玩家被送回頁首重新找操作位置。
        if (this.phase !== 'playing' || this.paused || document.querySelector('dialog[open]')) return;
        const active = document.activeElement;
        if (active !== document.body && active !== focusedCard) return;
        const buttons = Array.from(this.hostElement.nativeElement.querySelectorAll<HTMLButtonElement>('.memory-card'));
        const next = buttons.slice(secondIndex + 1).find(button => !button.disabled) ?? buttons.find(button => !button.disabled);
        (next ?? this.hostElement.nativeElement.querySelector<HTMLButtonElement>('.play-actions button:not(:disabled)'))?.focus({ preventScroll: true });
      });
    };
    this.memoryTimer = setTimeout(this.pendingMemoryPair, 650);
  }

  completeAttempt(): void {
    if (!this.attempt || !this.canComplete || this.completing) return;
    this.completing = true;
    this.error = '';
    if (!this.pendingResult) {
      const rawScore = this.score();
      this.pendingResult = { rawScore, rawResultJson: JSON.stringify(this.resultPayload(rawScore)) };
      this.persistSessionState();
    }
    this.game.completeMiniGame(this.attempt.attemptId, this.pendingResult).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => { this.completing = false; this.changeDetector.markForCheck(); })).subscribe({
      next: (result) => {
        this.complete = result;
        this.phase = 'complete';
        this.clearSessionState();
        this.scrollToTop();
        this.changeDetector.markForCheck();
        requestAnimationFrame(() => this.hostElement.nativeElement.querySelector<HTMLElement>('#result-title')?.focus({ preventScroll: true }));
      },
      error: (error: unknown) => { this.setError(error); this.changeDetector.markForCheck(); }
    });
  }

  get resultFrozen(): boolean { return this.pendingResult !== null; }

  exitAttempt(): void {
    if (!this.attempt || this.completing) return;
    // ui-integration: 小遊戲沒有既有取消 API，離開前明確告知進度不會送出，避免玩家誤以為結果已保存。
    if (!this.confirmLeaving) { this.openPause(); this.confirmLeaving = true; return; }
    this.attempt = null;
    this.complete = null;
    this.phase = 'list';
    this.resetBoard();
    this.error = '';
    this.clearSessionState();
    this.scrollToTop();
  }

  playAgain(): void {
    if (this.attempt) this.start({ code: this.attempt.modeCode });
  }

  showModeList(): void {
    if (this.starting || this.completing) return;
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

  protected beginAttempt(attempt: MiniGameStart): void {
    this.pendingResult = null;
    this.puzzleHintRegion = null;
    this.restoreHintRegion = null;
    this.attempt = attempt;
    this.complete = null;
    this.authRequired = false;
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
    this.focusInitialBoard();
  }

  private restoreSessionState(): void {
    const raw = this.readSessionState();
    if (!raw) return;
    if (!raw.ownerId && this.isValidAttempt(raw.attempt)) {
      this.game.verifyMiniGameOwner(raw.attempt.attemptId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          if (this.phase !== 'list' || this.starting || this.readSessionState()?.attempt.attemptId !== raw.attempt.attemptId) return;
          raw.ownerId = this.ownerId;
          try { sessionStorage.setItem('qmah-mini-game-session-v1', JSON.stringify(raw)); } catch { return; }
          this.restoreSessionState(); this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 404) this.clearSessionState();
          else { this.setError(error); this.changeDetector.markForCheck(); }
        }
      });
      return;
    }
    if (raw.ownerId !== this.ownerId || !this.isValidAttempt(raw.attempt)) {
      this.clearSessionState();
      return;
    }

    this.attempt = raw.attempt;
    this.complete = null;
    this.phase = 'playing';
    const savedSeconds = Number.isFinite(raw.elapsedSeconds) ? Math.max(0, raw.elapsedSeconds) : 0;
    this.attemptStartedAt = Date.now() - savedSeconds * 1000;
    this.elapsedSeconds = savedSeconds;
    this.imageUnavailable = false;
    this.setLocatorCrop(this.attempt.seed);
    this.resetBoard();
    if (raw.pendingResult && Number.isFinite(raw.pendingResult.rawScore) && typeof raw.pendingResult.rawResultJson === 'string') this.pendingResult = raw.pendingResult;
    this.puzzleHintRegion = Number.isInteger(raw.puzzleHintRegion) && raw.puzzleHintRegion! >= 0 && raw.puzzleHintRegion! < 4 ? raw.puzzleHintRegion! : null;
    this.restoreHintRegion = Number.isInteger(raw.restoreHintRegion) && raw.restoreHintRegion! >= 0 && raw.restoreHintRegion! < 4 ? raw.restoreHintRegion! : null;
    this.moves = Number.isInteger(raw.moves) && raw.moves! >= 0 ? raw.moves! : 0;
    this.hintsUsed = Number.isInteger(raw.hintsUsed) && raw.hintsUsed! >= 0 ? raw.hintsUsed! : 0;
    this.autoPlaced = Number.isInteger(raw.autoPlaced) && raw.autoPlaced! >= 0 ? raw.autoPlaced! : 0;
    if (Array.isArray(raw.hintedArtifactIds)) raw.hintedArtifactIds.filter(id => typeof id === 'string').forEach(id => this.hintedArtifacts.add(id));
    if (Array.isArray(raw.locatorExcludedIds)) this.locatorExcludedIds = this.locatorOptions.filter(option => option.artifactId !== this.attempt?.artifactId && raw.locatorExcludedIds!.includes(option.artifactId)).slice(0, Math.max(0, this.locatorOptions.length - 2)).map(option => option.artifactId);
    if (this.attempt.modeCode === 'ARTIFACT_PUZZLE' && this.isPlacement(raw.puzzleOrder, 25)) {
      this.puzzleOrder = raw.puzzleOrder;
      this.puzzleSelection = this.validSlot(raw.puzzleSelection, 25);
    }
    if (this.attempt.modeCode === 'STRIP_RESTORE' && this.isPlacement(raw.restoreOrder, 15)) {
      this.restoreOrder = raw.restoreOrder;
      this.restoreSelection = this.validSlot(raw.restoreSelection, 15);
    }
    if (this.attempt.modeCode === 'DETAIL_LOCATOR' && Array.isArray(raw.locatorAnswers)) {
      for (const answer of raw.locatorAnswers.slice(0, 4)) {
        if (!validLocatorAnswer(answer) || answer.artifactId !== this.locatorOptions[this.locatorAnswers.length]?.artifactId) break;
        this.locatorAnswers.push(answer);
      }
    }
    if (this.attempt.modeCode === 'DETAIL_LOCATOR' && Array.isArray(raw.locatorAssistedIds)) {
      const expected = this.locatorOptions.slice(this.locatorAnswers.length).map(artifact => artifact.artifactId);
      if (raw.locatorAssistedIds.length === expected.length && raw.locatorAssistedIds.every((id, index) => id === expected[index])) this.locatorAssistedIds = [...raw.locatorAssistedIds];
    }
    if (this.attempt.modeCode === 'MEMORY_MATCH') {
      const matched = new Set(Array.isArray(raw.matchedCardIds) ? raw.matchedCardIds : []);
      this.memoryCards = this.memoryCards.map((card) => {
        const pair = this.memoryCards.filter(candidate => candidate.artifactId === card.artifactId);
        return { ...card, matched: pair.length === 2 && pair.every(candidate => matched.has(candidate.id)) };
      });
      this.memoryMatched = this.memoryCards.filter((card) => card.matched).length / 2;
    }
    this.loadCatalogHints(this.attempt);
  }

  protected persistSessionState(): void {
    if (this.phase !== 'playing' || !this.attempt) return;
    const placementState = this.playSheet?.placementState();
    const scrollState = this.playSheet?.scrollState();
    const snapshot: TrainingSessionSnapshot = {
      ownerId: this.ownerId,
      pendingResult: this.pendingResult ?? undefined,
      puzzleHintRegion: placementState ? placementState.hintRegion : this.puzzleHintRegion,
      restoreHintRegion: scrollState ? scrollState.hintRegion : this.restoreHintRegion,
      attempt: this.attempt,
      elapsedSeconds: this.elapsedSeconds,
      puzzleOrder: this.puzzleOrder,
      puzzleSelection: placementState ? placementState.selection : this.puzzleSelection,
      restoreOrder: this.restoreOrder,
      restoreSelection: scrollState ? scrollState.selection : this.restoreSelection,
      locatorAnswers: this.locatorAnswers,
      locatorAssistedIds: this.locatorAssistedIds,
      matchedCardIds: this.memoryCards.filter((card) => card.matched).map((card) => card.id),
      moves: this.moves,
      hintsUsed: this.hintsUsed,
      autoPlaced: this.autoPlaced,
      hintedArtifactIds: [...this.hintedArtifacts],
      locatorExcludedIds: this.locatorExcludedIds
    };
    try { sessionStorage.setItem('qmah-mini-game-session-v1', JSON.stringify(snapshot)); } catch { /* private mode/storage quota: gameplay remains usable */ }
  }

  protected clearSessionState(): void {
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
    return typeof attempt.attemptId === 'string' && attempt.attemptId.length > 0
      && ['DETAIL_LOCATOR', 'MEMORY_MATCH', 'ARTIFACT_PUZZLE', 'STRIP_RESTORE'].includes(attempt.modeCode ?? '')
      && typeof attempt.seed === 'string'
      && typeof attempt.difficulty === 'string' && typeof attempt.modeName === 'string'
      && typeof attempt.primaryImagePath === 'string'
      && typeof attempt.artifactId === 'string' && typeof attempt.artifactName === 'string'
      && Array.isArray(attempt.artifactPool)
      && attempt.artifactPool.every(artifact => artifact && typeof artifact.artifactId === 'string' && typeof artifact.name === 'string');
  }

  private isPlacement(order: number[], length: number): boolean {
    return Array.isArray(order) && order.length === length && order.every(value => Number.isInteger(value) && value >= -1 && value < length) && new Set(order.filter(value => value >= 0)).size === order.filter(value => value >= 0).length;
  }

  private validSlot(slot: number | null, length: number): number | null {
    return typeof slot === 'number' && Number.isInteger(slot) && slot >= 0 && slot < length ? slot : null;
  }

  protected loadCatalogHints(attempt: MiniGameStart): void {
    if (attempt.modeCode === 'DETAIL_LOCATOR') return;
    const fallback = this.fallbackArtifact(attempt);
    const pool = attempt.artifactPool.length ? attempt.artifactPool : [fallback];
    const candidates = attempt.modeCode === 'MEMORY_MATCH'
      ? this.shuffle(pool, `${attempt.seed}-catalog-hints`).slice(0, 5)
      : [pool.find((artifact) => artifact.artifactId === attempt.artifactId) ?? fallback];
    const details = candidates.map((candidate) => this.catalog.getArtifactById(candidate.artifactId).pipe(catchError(() => of(null))));

    forkJoin(details).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((results) => {
      if (this.attempt?.attemptId !== attempt.attemptId) return;
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
    this.pendingMemoryPair = null;
    this.moves = 0;
    this.hintsUsed = 0;
    this.autoPlaced = 0;
    this.hintedArtifacts.clear();
    this.locatorExcludedIds = [];
    this.failedImages.clear();
    this.syncFailedImageKeys();
    this.locatorAnswers = [];
    this.locatorAssistedIds = [];
    this.puzzleOrder = Array<number>(25).fill(-1);
    this.puzzleSelection = null;
    this.restoreOrder = Array<number>(15).fill(-1);
    this.restoreSelection = null;
    this.memoryOpen = [];
    this.memoryMatched = 0;
    this.memoryFeedback = '翻開一張牌，記住文物與位置。';
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
      case 'DETAIL_LOCATOR': return this.locatorOptions.length ? Math.round((this.locatorAnswers.filter(answer => locatorCorrect(this.attempt!.seed, answer)).length + this.locatorAssistedIds.length) / this.locatorOptions.length * 100) : 0;
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
      scoringVersion: this.attempt?.modeCode === 'DETAIL_LOCATOR' ? 4 : 3,
      elapsedSeconds: this.elapsedSeconds,
      moves: this.moves,
      hintsUsed: this.hintsUsed,
      autoPlaced: this.autoPlaced,
      locatorAnswers: this.locatorAnswers,
      locatorAssistedIds: this.locatorAssistedIds,
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

  protected focusInitialBoard(): void {
    requestAnimationFrame(() => this.hostElement.nativeElement.querySelector<HTMLElement>('.game-board button:not(:disabled), .pause-trigger')?.focus({ preventScroll: true }));
  }

  protected scrollToTop(): void {
    // ui-integration: 狀態由列表切到遊玩或結算時，將視線帶回遊戲標題，避免沿用列表捲動位置造成流程斷裂。
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  }
}
