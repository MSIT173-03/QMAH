import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import {
  MiniGameArtifact,
  MiniGameComplete,
  MiniGameMode,
  MiniGameStart
} from './game.models';
import { GameService } from './game.service';

type TrainingPhase = 'list' | 'playing' | 'complete';

interface MemoryCard {
  id: string;
  artifactId: string;
  name: string;
  image: string;
  revealed: boolean;
  matched: boolean;
}

interface GuideStep {
  title: string;
  description: string;
  visual: string;
}

@Component({
  selector: 'app-game-training',
  imports: [RouterLink],
  styleUrl: './game-training.component.scss',
  template: `
    <main class="training-notebook">
      <header class="masthead">
        <a routerLink="/" aria-label="回到清明鑑定屋"><img src="/assets/brand/qmah-logo.svg" alt="清明鑑定屋" /></a>
      </header>
      <nav class="bookmarks" aria-label="遊戲模式">
        <a routerLink="/game"><small>線上</small>多人鑑定</a>
        <a routerLink="/game/minigames" aria-current="page" class="active"><small>單人</small>小遊戲</a>
      </nav>

      <section class="chapter" aria-labelledby="training-title">
        <header class="chapter-heading">
          <div><p>一個人也能玩</p><h1 id="training-title">單人小遊戲</h1></div>
          <a routerLink="/game">回到房間</a>
        </header>

        @if (error) { <div class="message error" role="alert"><strong>{{ authRequired ? '需要登入才能開始小遊戲' : '訓練模式載入失敗' }}</strong><span>{{ error }}</span>@if (authRequired) { <div class="auth-actions"><a routerLink="/">回到登入入口</a><button type="button" (click)="retryModes()">重新嘗試</button></div> }</div> }
        @if (loading) { <div class="loading" role="status">正在讀取訓練模式…</div> }
        @else if (phase === 'complete') {
          @if (complete; as result) {
            <section class="result-sheet" aria-live="polite">
              <p class="kicker">本局完成</p>
              <h2>{{ result.grade }} 級 <span>{{ result.normalizedScore }} 分</span></h2>
              <p>點數 {{ result.pointReward }} · 鑰匙進度 +{{ result.keyProgressReward }}</p>
              @if (!result.economicRewardGranted) { <small>今日獎勵額度已用完，成績仍會保留。</small> }
              <div class="result-actions"><button type="button" (click)="playAgain()">再玩一次</button><a routerLink="/game">查看房間</a></div>
            </section>
          }
        }
        @else if (authRequired) {
          <section class="auth-state" aria-labelledby="auth-state-title"><h2 id="auth-state-title">登入後即可開始訓練</h2><p>小遊戲需要會員工作階段，登入後再回到這裡就能保留成績。</p><a routerLink="/">回到入口登入</a></section>
        }
        @else if (attempt; as current) {
          <section class="play-sheet" aria-live="polite">
            <header class="play-heading">
              <div><p class="kicker">{{ current.modeName }}</p><h2>{{ current.artifactName }}</h2></div>
              <span class="difficulty">{{ difficultyText(current.difficulty) }}</span>
            </header>

            @if (current.modeCode === 'DETAIL_LOCATOR') {
              <div class="locator-game">
                <div class="clue-image"><img [src]="current.primaryImagePath" [alt]="current.artifactName" (error)="imageUnavailable = true" />@if (imageUnavailable) { <span>圖片無法顯示，請依文物名稱選擇。</span> }</div>
                <div class="game-prompt"><h3>這件線索屬於哪一件文物？</h3><p>從素材池選出你的判斷。</p><div class="artifact-options">@for (option of locatorOptions; track option.artifactId) { <button type="button" [class.selected]="locatorChoice === option.artifactId" [attr.aria-pressed]="locatorChoice === option.artifactId" (click)="chooseLocator(option.artifactId)"><img [src]="option.thumbnailPath || option.primaryImagePath" [alt]="option.name" /><span>{{ option.name }}</span></button> }</div></div>
              </div>
            }
            @else if (current.modeCode === 'MEMORY_MATCH') {
              <div class="memory-game"><div class="game-prompt"><h3>翻牌配對</h3><p>翻開兩張相同文物；全部配對後送出結果。</p></div><div class="memory-grid">@for (card of memoryCards; track card.id; let index = $index) { <button type="button" class="memory-card" [class.is-open]="card.revealed || card.matched" [class.is-matched]="card.matched" (click)="flipMemory(index)" [attr.aria-label]="card.revealed || card.matched ? card.name : '翻開卡片'">@if (card.revealed || card.matched) { <img [src]="card.image" [alt]="card.name" /> } @else { <span>翻</span> }</button> }</div><p class="game-hint">已配對 {{ memoryMatched }} / {{ memoryPairCount }}</p></div>
            }
            @else if (current.modeCode === 'ARTIFACT_PUZZLE') {
              <div class="ordering-game"><div class="game-prompt"><h3>館藏拼圖</h3><p>點選兩塊交換位置，把畫面排回順序。</p></div><div class="tile-grid">@for (piece of puzzleOrder; track $index; let slot = $index) { <button type="button" class="image-tile" [class.selected]="puzzleSelection === slot" [attr.aria-pressed]="puzzleSelection === slot" (click)="swapPuzzle(slot)"><img [src]="current.primaryImagePath" [alt]="current.artifactName + ' 拼圖 ' + (piece + 1)" [style.object-position]="piecePosition(piece)" /><b>{{ slot + 1 }}</b></button> }</div><p class="game-hint">{{ puzzleSelection === null ? '先選一塊拼圖' : '再選另一塊交換' }}</p></div>
            }
            @else {
              <div class="ordering-game"><div class="game-prompt"><h3>長卷復位</h3><p>點選兩段交換位置，讓長卷從左到右接回原貌。</p></div><div class="strip-row">@for (strip of restoreOrder; track $index; let slot = $index) { <button type="button" class="image-strip" [class.selected]="restoreSelection === slot" [attr.aria-pressed]="restoreSelection === slot" (click)="swapRestore(slot)"><img [src]="current.primaryImagePath" [alt]="current.artifactName + ' 長卷段落 ' + (strip + 1)" [style.object-position]="stripPosition(strip)" /><b>{{ slot + 1 }}</b></button> }</div><p class="game-hint">{{ restoreSelection === null ? '先選一段長卷' : '再選另一段交換' }}</p></div>
            }

            <footer class="play-footer"><span>{{ progressText }}</span><button type="button" (click)="completeAttempt()" [disabled]="!canComplete || completing">{{ completing ? '送出中…' : '送出結果' }}</button></footer>
          </section>
        }
        @else if (modes.length) {
          <section class="training-hero" aria-labelledby="training-hero-title">
            <div class="training-hero-copy">
              <h2 id="training-hero-title">挑一件館藏，<br />開始觀察。</h2>
              <p>四種短局玩法，讓你用眼力、記憶與判斷，熟悉每件文物的細節。</p>
            </div>
            <figure class="training-artwork">
              <img src="/assets/game/tang-wang.jpg" alt="元趙孟頫湯王徵尹圖軸" />
              <figcaption><span>單人練習</span><strong>先看，再下判斷</strong></figcaption>
            </figure>
          </section>
          <p class="intro">選一種玩法，完成一個小任務。成績會送回遊戲服務結算。</p>
          <section class="guide" aria-labelledby="guide-title">
            <header class="guide-heading"><div><p class="kicker">玩法示範</p><h2 id="guide-title">三步看懂怎麼玩</h2></div><span>第 {{ demoStep + 1 }} / {{ guideSteps.length }} 步</span></header>
            <nav class="guide-modes" aria-label="選擇示範玩法">@for (mode of modes; track mode.id) { <button type="button" [class.active]="demoModeCode === mode.code" [attr.aria-pressed]="demoModeCode === mode.code" (click)="selectGuideMode(mode.code)">{{ mode.name }}</button> }</nav>
            <div class="guide-step">
              <div class="guide-visual"><small>第 {{ demoStep + 1 }} 步</small><strong>{{ currentGuideStep.visual }}</strong></div>
              <div class="guide-copy"><h3>{{ currentGuideStep.title }}</h3><p>{{ currentGuideStep.description }}</p><div class="guide-controls"><button type="button" class="secondary" (click)="previousGuideStep()" [disabled]="demoStep === 0">上一步</button><button type="button" (click)="nextGuideStep()" [disabled]="demoStep >= guideSteps.length - 1">下一步</button><button type="button" class="secondary" (click)="startGuideMode()" [disabled]="starting">開始這個玩法</button></div></div>
            </div>
          </section>
          <ol class="mode-index">@for (mode of modes; track mode.id; let index = $index) { <li><b>{{ (index + 1).toString().padStart(2, '0') }}</b><div><h2>{{ mode.name }}</h2><p>{{ mode.description }}</p></div><button type="button" (click)="start(mode)" [disabled]="starting">{{ starting ? '準備中…' : '開始練習 →' }}</button></li> }</ol>
        }
        @else { <div class="loading">目前沒有啟用的訓練模式。</div> }
      </section>
    </main>
  `,
})
export class GameTrainingComponent implements OnInit, OnDestroy {
  readonly game = inject(GameService);
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
  demoModeCode = '';
  demoStep = 0;

  locatorChoice: string | null = null;
  puzzleOrder: number[] = [];
  puzzleSelection: number | null = null;
  restoreOrder: number[] = [];
  restoreSelection: number | null = null;
  memoryCards: MemoryCard[] = [];
  memoryOpen: number[] = [];
  memoryMatched = 0;
  memoryBusy = false;
  private memoryTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void { this.loadModes(); }

  retryModes(): void { this.loadModes(); }

  private loadModes(): void {
    this.loading = true;
    this.authRequired = false;
    this.error = '';
    this.game.getMiniGameModes().pipe(finalize(() => { this.loading = false; this.changeDetector.markForCheck(); })).subscribe({
      next: (modes) => {
        this.modes = modes;
        if (!this.demoModeCode && modes[0]) this.demoModeCode = modes[0].code;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => { this.setError(error); this.changeDetector.markForCheck(); }
    });
  }

  ngOnDestroy(): void {
    if (this.memoryTimer !== null) clearTimeout(this.memoryTimer);
  }

  get locatorOptions(): MiniGameArtifact[] {
    return this.attempt?.artifactPool.length ? this.attempt.artifactPool : this.attempt ? [this.fallbackArtifact(this.attempt)] : [];
  }

  get memoryPairCount(): number { return Math.floor(this.memoryCards.length / 2); }

  get guideSteps(): GuideStep[] {
    switch (this.demoModeCode) {
      case 'DETAIL_LOCATOR':
        return [
          { visual: '看線索', title: '先看清楚線索', description: '記住線索影像的形狀與顏色，再往下一步比對文物。' },
          { visual: '選文物', title: '選出你的判斷', description: '從素材池點選你認為與線索相同的文物。' },
          { visual: '送出', title: '送出答案', description: '確認選擇後送出，遊戲服務會結算本次分數。' }
        ];
      case 'ARTIFACT_PUZZLE':
        return [
          { visual: '看拼圖', title: '查看四塊拼圖', description: '畫面會把文物切成四塊，順序一開始是打亂的。' },
          { visual: '交換', title: '交換拼圖位置', description: '依序點選兩塊拼圖，就能互換它們的位置。' },
          { visual: '完成', title: '排回完整畫面', description: '四塊拼圖回到正確順序後，送出結果。' }
        ];
      case 'MEMORY_MATCH':
        return [
          { visual: '翻牌', title: '一次翻開兩張', description: '點選卡片查看文物，記住每張卡片的位置。' },
          { visual: '配對', title: '找出相同文物', description: '兩張相同的卡片會留在桌面，不同的卡片會蓋回去。' },
          { visual: '完成', title: '完成所有配對', description: '全部配對完成後，送出結果。' }
        ];
      case 'STRIP_RESTORE':
        return [
          { visual: '看長卷', title: '先辨認畫面方向', description: '觀察人物、景物與畫面邊緣，找出長卷的前後關係。' },
          { visual: '交換', title: '交換段落位置', description: '依序點選兩段長卷，就能互換它們的位置。' },
          { visual: '完成', title: '接回完整長卷', description: '由左至右排好四段後，送出結果。' }
        ];
      default:
        return [
          { visual: '閱讀', title: '先看玩法提示', description: '開始前先讀取這個模式的操作說明。' },
          { visual: '操作', title: '完成畫面上的任務', description: '依照提示操作，直到畫面顯示可以送出結果。' },
          { visual: '送出', title: '送出結果', description: '完成任務後送出，遊戲服務會結算本次分數。' }
        ];
    }
  }

  get currentGuideStep(): GuideStep {
    return this.guideSteps[this.demoStep] ?? this.guideSteps[0];
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
      case 'ARTIFACT_PUZZLE': return this.isSolved(this.puzzleOrder) ? '拼圖完成' : '交換拼圖直到完成';
      default: return this.isSolved(this.restoreOrder) ? '長卷完成' : '交換段落直到完成';
    }
  }

  difficultyText(difficulty: string): string {
    return { EASY: '簡單', NORMAL: '一般', HARD: '困難', EXPERT: '專家' }[difficulty.trim().toUpperCase()] ?? difficulty;
  }

  selectGuideMode(modeCode: string): void {
    this.demoModeCode = modeCode;
    this.demoStep = 0;
  }

  previousGuideStep(): void { this.demoStep = Math.max(0, this.demoStep - 1); }
  nextGuideStep(): void { this.demoStep = Math.min(this.guideSteps.length - 1, this.demoStep + 1); }

  startGuideMode(): void {
    const mode = this.modes.find((item) => item.code === this.demoModeCode);
    if (mode) this.start(mode);
  }

  start(mode: MiniGameMode): void {
    this.starting = true;
    this.error = '';
    this.game.startMiniGame(mode.code).pipe(finalize(() => { this.starting = false; this.changeDetector.markForCheck(); })).subscribe({
      next: (attempt) => { this.beginAttempt(attempt); this.changeDetector.markForCheck(); },
      error: (error: unknown) => { this.setError(error); this.changeDetector.markForCheck(); }
    });
  }

  chooseLocator(artifactId: string): void { if (this.phase === 'playing') this.locatorChoice = artifactId; }

  swapPuzzle(slot: number): void {
    if (this.puzzleSelection === null) { this.puzzleSelection = slot; return; }
    if (this.puzzleSelection === slot) { this.puzzleSelection = null; return; }
    this.swap(this.puzzleOrder, this.puzzleSelection, slot);
    this.puzzleSelection = null;
  }

  swapRestore(slot: number): void {
    if (this.restoreSelection === null) { this.restoreSelection = slot; return; }
    if (this.restoreSelection === slot) { this.restoreSelection = null; return; }
    this.swap(this.restoreOrder, this.restoreSelection, slot);
    this.restoreSelection = null;
  }

  flipMemory(index: number): void {
    if (this.phase !== 'playing' || this.memoryBusy) return;
    const card = this.memoryCards[index];
    if (!card || card.revealed || card.matched) return;
    card.revealed = true;
    this.memoryOpen = [...this.memoryOpen, index];
    if (this.memoryOpen.length < 2) return;
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
      next: (result) => { this.complete = result; this.phase = 'complete'; this.changeDetector.markForCheck(); },
      error: (error: unknown) => { this.setError(error); this.changeDetector.markForCheck(); }
    });
  }

  playAgain(): void {
    this.attempt = null;
    this.complete = null;
    this.phase = 'list';
    this.resetBoard();
    this.error = '';
  }

  piecePosition(piece: number): string { return `${(piece % 2) * 100}% ${Math.floor(piece / 2) * 100}%`; }
  stripPosition(strip: number): string { return `${strip * 33.3333}% 50%`; }

  private beginAttempt(attempt: MiniGameStart): void {
    this.attempt = attempt;
    this.complete = null;
    this.phase = 'playing';
    this.imageUnavailable = false;
    this.resetBoard();
  }

  private resetBoard(): void {
    this.locatorChoice = null;
    this.puzzleOrder = this.shuffle([0, 1, 2, 3], this.attempt?.seed ?? 'puzzle');
    this.puzzleSelection = null;
    this.restoreOrder = this.shuffle([0, 1, 2, 3], `${this.attempt?.seed ?? 'restore'}-restore`);
    this.restoreSelection = null;
    this.memoryOpen = [];
    this.memoryMatched = 0;
    this.memoryBusy = false;
    if (this.memoryTimer !== null) clearTimeout(this.memoryTimer);
    this.memoryTimer = null;
    const pool = this.attempt?.artifactPool.length ? this.attempt.artifactPool : this.attempt ? [this.fallbackArtifact(this.attempt)] : [];
    const source = pool.length ? pool.slice(0, Math.min(pool.length, 4)) : [];
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

  private setError(error: unknown): void {
    this.authRequired = error instanceof HttpErrorResponse && error.status === 401;
    this.error = this.authRequired ? '請先登入會員，再開始或繼續小遊戲。' : this.game.errorMessage(error);
  }
}
