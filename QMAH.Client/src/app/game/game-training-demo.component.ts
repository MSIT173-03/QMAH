import { Component, OnChanges, inject, ChangeDetectorRef } from '@angular/core';
import { input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameTrainingComponent } from './game-training.component';
import { GameTrainingPlaySheetComponent } from './game-training-play-sheet.component';
import { MiniGameArtifact, MiniGameStart } from './game.models';

const SAMPLES: MiniGameArtifact[] = [
  { artifactId: 'demo-cloisonne', name: '掐絲琺瑯三足香爐', primaryImagePath: '/images/login/real/cloisonne-tripod-incense-burner.jpg', thumbnailPath: null },
  { artifactId: 'demo-figure', name: '人物山水畫', primaryImagePath: '/assets/game/tang-wang.jpg', thumbnailPath: null },
  { artifactId: 'demo-vase', name: '陶瓷方瓶', primaryImagePath: '/assets/game/ceramic-square-vase.jpg', thumbnailPath: null },
  { artifactId: 'demo-scroll-a', name: '畫卷片段甲', primaryImagePath: '/images/login/real/qingming-iiif/segment-SDAAA-compact.jpg', thumbnailPath: null },
  { artifactId: 'demo-scroll-b', name: '畫卷片段乙', primaryImagePath: '/images/login/real/qingming-iiif/segment-SDAAB-compact.jpg', thumbnailPath: null },
  { artifactId: 'demo-scroll-c', name: '畫卷片段丙', primaryImagePath: '/images/login/museum/qingming-court/segment-01.webp', thumbnailPath: null },
  { artifactId: 'demo-scroll-d', name: '畫卷片段丁', primaryImagePath: '/images/login/museum/qingming-court/segment-06.webp', thumbnailPath: null },
  { artifactId: 'demo-scroll-e', name: '畫卷片段戊', primaryImagePath: '/images/login/museum/qingming-court/segment-10.webp', thumbnailPath: null }
];

/** 示範沿用正式控制器與盤面；只替換題目來源、存檔與結算出口。 */
@Component({
  selector: 'app-game-training-demo',
  imports: [RouterLink, GameTrainingPlaySheetComponent],
  templateUrl: './game-training-demo.component.html',
  styleUrl: './game-training-demo.component.scss'
})
export class GameTrainingDemoComponent extends GameTrainingComponent implements OnChanges {
  readonly modeCode = input.required<string>();
  private readonly demoDetector = inject(ChangeDetectorRef);
  private demoTimer: ReturnType<typeof setInterval> | null = null;
  private demoTicks = 0;
  private completionTicks = 0;
  autoPlaying = true;

  override ngOnInit(): void { /* 本機示範不載入正式挑戰、會員或存檔。 */ }
  ngOnChanges(): void { this.restartDemo(); }
  override ngOnDestroy(): void {
    if (this.demoTimer !== null) clearInterval(this.demoTimer);
    this.stopAttemptTimers();
  }

  restartDemo(): void {
    if (this.demoTimer !== null) clearInterval(this.demoTimer);
    this.closePause();
    this.paused = false;
    this.autoPlaying = true;
    this.demoTicks = 0;
    this.completionTicks = 0;
    const modeCode = this.modeCode();
    const modeName = ({ DETAIL_LOCATOR: '局部辨識', MEMORY_MATCH: '翻牌配對', ARTIFACT_PUZZLE: '館藏拼圖', STRIP_RESTORE: '長卷復位' } as Record<string, string>)[modeCode] ?? '館藏挑戰';
    const target = modeCode === 'STRIP_RESTORE'
      ? { artifactId: 'demo-painting', name: '東海道五十三次・戶塚', primaryImagePath: '/media/catalog/painting/南購畫00001600000/display.jpg', thumbnailPath: null }
      : SAMPLES[0];
    this.beginAttempt({ attemptId: `demo-${modeCode}`, modeCode, modeName, ...target, artifactName: target.name,
      artifactPool: modeCode === 'DETAIL_LOCATOR' ? SAMPLES.slice(0, 4) : SAMPLES,
      difficulty: 'NORMAL', seed: 'qmah-demo-v1', configJson: null, startedAt: new Date().toISOString() });
    this.demoTimer = setInterval(() => {
      if (this.paused || this.phase !== 'playing') return;
      this.demoTicks++;
      this.elapsedSeconds = Math.floor(this.demoTicks / 2);
      if (this.autoPlaying) this.advanceDemo();
      this.demoDetector.markForCheck();
    }, 500);
  }

  toggleAutoPlay(): void { this.autoPlaying = !this.autoPlaying; }
  override completeAttempt(): void {
    if (!this.canComplete || this.paused) return;
    this.phase = 'complete';
    if (this.demoTimer !== null) clearInterval(this.demoTimer);
    this.demoTimer = null;
  }
  protected override persistSessionState(): void { /* 不覆蓋正式遊戲的 sessionStorage。 */ }
  protected override clearSessionState(): void { /* 正式存檔由正式控制器管理。 */ }
  protected override loadCatalogHints(_attempt: MiniGameStart): void { /* 示範不查詢假文物 ID。 */ }
  protected override scrollToTop(): void { /* 切換示範時保留閱讀位置。 */ }
  protected override focusInitialBoard(): void { /* 自動示範不搶走鍵盤焦點。 */ }

  private advanceDemo(): void {
    if (document.querySelector('dialog[open]') || this.imageUnavailable || this.failedImageKeys.length) return;
    if (this.canComplete) {
      if (++this.completionTicks >= 2) this.completeAttempt();
      return;
    }
    this.completionTicks = 0;
    if (this.demoTicks < 3) return;
    if (this.attempt?.modeCode === 'DETAIL_LOCATOR') {
      if (this.demoTicks % 3 === 0) this.playSheet?.advanceDemonstration();
    } else if (this.attempt?.modeCode === 'MEMORY_MATCH') {
      if (this.memoryBusy) return;
      const first = this.memoryOpen[0];
      const next = first === undefined
        ? this.memoryCards.findIndex(card => !card.matched && !card.revealed)
        : this.memoryCards.findIndex((card, index) => index !== first && !card.matched && !card.revealed && card.artifactId === this.memoryCards[first].artifactId);
      if (next >= 0) this.flipMemory(next);
    } else {
      this.playSheet?.advanceDemonstration();
    }
  }
}
