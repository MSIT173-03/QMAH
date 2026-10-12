import { Component, ElementRef, OnChanges, inject, ChangeDetectorRef, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { input } from '@angular/core';
import { GameTrainingComponent } from './game-training.component';
import { GameTrainingPlaySheetComponent } from './game-training-play-sheet.component';
import { MiniGameArtifact, MiniGameStart } from './game.models';

const PUZZLE_SAMPLES: MiniGameArtifact[] = [
  { artifactId: 'demo-cloisonne', name: '掐絲琺瑯三足香爐', primaryImagePath: '/images/login/real/cloisonne-tripod-incense-burner.jpg', thumbnailPath: null },
  { artifactId: 'demo-vase', name: '陶瓷方瓶', primaryImagePath: '/assets/game/ceramic-square-vase.jpg', thumbnailPath: null },
  { artifactId: 'demo-redbox', name: '剔紅十六瓣盒', primaryImagePath: '/media/catalog/lacquer/中漆000039N000000000/display.jpg', thumbnailPath: null }
];
// 翻牌示範：挑比例接近方形的器物，牌面小也看得出差異（不放長卷）
const MEMORY_SAMPLES: MiniGameArtifact[] = [
  ['1337d4fe-6447-84fd-4115-000b60825b05', '剔紅番蓮紋瓶', 'lacquer/中漆000061N000000000'], ['ab0fd8e3-04ed-c5b8-51be-040763090373', '褐漆葵花式盤', 'lacquer/贈漆000006N000000000'],
  ['e42d52fe-d579-d929-94dd-045a8d469544', '有田窯五彩方盤', 'ceramic/故瓷009276N000000000'], ['4808dfa9-8de2-8d30-cf74-05f42b2850b7', '剔紅十六瓣盒', 'lacquer/中漆000039N000000000'],
  ['demo-jade', '玉器紋飾瓶', 'jade/中玉000002N000000000'], ['0d5ee27a-75e5-f401-d0e9-08080612147b', '掐絲琺瑯靶碗', 'enamel/中琺000009N000000000'],
  ['6769c966-acf8-4027-29fc-081b56671622', '白瓷花口碗', 'ceramic/中瓷005531N000000000'], ['demo-carving', '雕刻紋飾器', 'carving/中雕000001N000000000']
].map(([artifactId, name, path]) => ({ artifactId, name, primaryImagePath: `/media/catalog/${path}/display.jpg`, thumbnailPath: null }));
const PAINTING_SAMPLES: MiniGameArtifact[] = [
  { artifactId: 'demo-kawasaki', name: '東海道五十三次 川崎', primaryImagePath: '/media/catalog/painting/南購畫00001300000/display.jpg', thumbnailPath: null },
  { artifactId: 'demo-nihonbashi', name: '東海道五十三次 日本橋', primaryImagePath: '/media/catalog/painting/南購畫00001100000/display.jpg', thumbnailPath: null },
  { artifactId: 'af0a1fe0-aee2-dcb5-2152-908ae76d88c5', name: '東海道五十三次 戶塚', primaryImagePath: '/media/catalog/painting/南購畫00001600000/display.jpg', thumbnailPath: null }
];
const LOCATOR_SAMPLES: MiniGameArtifact[] = [
  PUZZLE_SAMPLES[0],
  { artifactId: 'demo-ivory', name: '鏤雕象牙雲龍紋套球', primaryImagePath: '/media/catalog/carving/中日雕000005N000000000/display.jpg', thumbnailPath: null },
  PUZZLE_SAMPLES[1], PUZZLE_SAMPLES[2]
];
// 由原圖分析後目視確認的示範位置，依序展示琺瑯紋樣、鏤雕、花卉與剔紅。
const LOCATOR_TARGETS = [
  { artifactId: 'demo-cloisonne', x: .475, y: .375, cropFraction: .25 },
  { artifactId: 'demo-ivory', x: .525, y: .175, cropFraction: .20 },
  { artifactId: 'demo-vase', x: .525, y: .675, cropFraction: .25 },
  { artifactId: 'demo-redbox', x: .275, y: .625, cropFraction: .30 }
];
/** 示範沿用正式控制器與盤面；只替換題目來源、存檔與結算出口。 */
@Component({
  selector: 'app-game-training-demo',
  imports: [GameTrainingPlaySheetComponent, RouterLink],
  templateUrl: './game-training-demo.component.html',
  styleUrl: './game-training-demo.component.scss'
})
export class GameTrainingDemoComponent extends GameTrainingComponent implements OnChanges {
  readonly modeCode = input.required<string>();
  private readonly demoDetector = inject(ChangeDetectorRef);
  private readonly helpDialog = viewChild<ElementRef<HTMLDialogElement>>('helpDialog');
  private readonly doneDialog = viewChild<ElementRef<HTMLDialogElement>>('doneDialog');
  private demoTimer: ReturnType<typeof setInterval> | null = null;
  private demoTicks = 0;
  private demoRound = -1;
  private completionTicks = 0;
  demoHard = false;
  autoPlaying = false;
  autoPlaySpeed = 1;

  override ngOnInit(): void { /* 本機示範不載入正式挑戰、會員或存檔。 */ }
  ngOnChanges(): void { this.restartDemo(); }
  override ngOnDestroy(): void {
    if (this.demoTimer !== null) clearInterval(this.demoTimer);
    this.stopAttemptTimers();
  }

  restartDemo(): void {
    if (this.demoTimer !== null) clearInterval(this.demoTimer);
    this.stopAttemptTimers();
    this.closePause();
    const done = this.doneDialog()?.nativeElement;
    if (done?.open) done.close();
    const help = this.helpDialog()?.nativeElement;
    if (help?.open) help.close();
    this.paused = false;
    this.autoPlaying = false;
    this.autoPlaySpeed = 1;
    this.demoTicks = 0;
    this.completionTicks = 0;
    const modeCode = this.modeCode();
    const modeName = ({ DETAIL_LOCATOR: '細節追跡', MEMORY_MATCH: '館藏翻牌', ARTIFACT_PUZZLE: '館藏拼圖', STRIP_RESTORE: '書畫拼貼' } as Record<string, string>)[modeCode] ?? '館藏挑戰';
    this.demoRound++;
    const target = modeCode === 'STRIP_RESTORE'
      ? PAINTING_SAMPLES[this.demoRound % PAINTING_SAMPLES.length]
      : modeCode === 'DETAIL_LOCATOR' ? LOCATOR_SAMPLES[0] : modeCode === 'MEMORY_MATCH' ? MEMORY_SAMPLES[0] : PUZZLE_SAMPLES[this.demoRound % PUZZLE_SAMPLES.length];
    this.beginAttempt({ attemptId: `demo-${modeCode}`, modeCode, modeName, ...target, artifactName: target.name,
      artifactPool: modeCode === 'DETAIL_LOCATOR' ? LOCATOR_SAMPLES : modeCode === 'MEMORY_MATCH' ? MEMORY_SAMPLES : modeCode === 'STRIP_RESTORE' ? PAINTING_SAMPLES : PUZZLE_SAMPLES,
      difficulty: this.demoHard ? 'HARD' : 'EASY', seed: `qmah-demo-v2-${this.demoHard ? 'h' : 'e'}-${this.demoRound}`, configJson: null,

      locatorTargets: modeCode === 'DETAIL_LOCATOR' ? LOCATOR_TARGETS : null, startedAt: new Date().toISOString() });
    this.demoTimer = setInterval(() => {
      if (this.paused || document.hidden || this.locatorReviewing || this.phase !== 'playing') return;
      this.demoTicks++;
      this.elapsedSeconds = Math.floor(this.demoTicks / 2);
      // 盤面完成後（自動示範或自己操作都一樣）稍等一下，用彈出視窗告知，不再留一顆孤立的「完成展示」按鈕
      if (this.canComplete && !this.imageUnavailable && !document.querySelector('dialog[open]')) { if (++this.completionTicks >= 2) { this.completeAttempt(); return; } } else this.completionTicks = 0;
      if (this.autoPlaying && (this.autoPlaySpeed === 2 || this.demoTicks % 2 === 0)) this.advanceDemo();
      this.demoDetector.markForCheck();
    }, 500);
  }

  openHelp(): void {
    const dialog = this.helpDialog()?.nativeElement;
    if (dialog && !dialog.open && typeof dialog.showModal === 'function') dialog.showModal();
  }
  useDemoHelp(automatic: boolean): void {
    const dialog = this.helpDialog()?.nativeElement;
    if (dialog?.open) dialog.close();
    this.useHelp(automatic);
    // 展示不計分：把正式遊戲裡的扣分字樣拿掉
    this.memoryFeedback = this.memoryFeedback.replace('這組提示扣 3 分，重看不再扣分。', '展示不扣分。');
    this.demoDetector.markForCheck();
  }
  setDemoHard(hard: boolean): void { if (this.demoHard !== hard) { this.demoHard = hard; this.restartDemo(); } }
  toggleAutoPlay(): void { this.autoPlaying = !this.autoPlaying; }
  setAutoPlaySpeed(event: Event): void {
    this.autoPlaySpeed = (event.target as HTMLSelectElement).value === '2' ? 2 : 1;
  }
  override completeAttempt(): void {
    if (!this.canComplete || this.paused) return;
    this.phase = 'complete';
    if (this.demoTimer !== null) clearInterval(this.demoTimer);
    this.demoTimer = null;
    this.demoDetector.detectChanges();
    // 細節追跡要能回頭複盤四題，所以改用頁面內的提示列，不蓋住盤面。
    if (this.modeCode() === 'DETAIL_LOCATOR') return;
    const dialog = this.doneDialog()?.nativeElement;
    if (dialog && !dialog.open && typeof dialog.showModal === 'function') dialog.showModal();
  }
  protected override persistSessionState(): void { /* 不覆蓋正式遊戲的 sessionStorage。 */ }
  protected override clearSessionState(): void { /* 正式存檔由正式控制器管理。 */ }
  protected override loadCatalogHints(attempt: MiniGameStart): void {
    if (attempt.modeCode === 'MEMORY_MATCH') {
      this.memoryHints = attempt.artifactPool.map(artifact => ({ artifactId: artifact.artifactId, name: artifact.name, description: null }));
    } else if (attempt.modeCode === 'STRIP_RESTORE' && !attempt.artifactId.startsWith('demo-')) {
      super.loadCatalogHints(attempt);
    }
  }
  protected override scrollToTop(): void { /* 切換示範時保留閱讀位置。 */ }
  protected override focusInitialBoard(): void { /* 自動示範不搶走鍵盤焦點。 */ }

  private advanceDemo(): void {
    if (document.querySelector('dialog[open]') || this.imageUnavailable || this.failedImageKeys.length) return;
    if (this.canComplete || this.demoTicks < 3) return;
    if (this.attempt?.modeCode === 'DETAIL_LOCATOR') {
      this.playSheet?.advanceDemonstration();
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
