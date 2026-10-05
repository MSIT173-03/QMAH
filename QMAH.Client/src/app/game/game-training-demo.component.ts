import { Component, OnChanges, inject, ChangeDetectorRef } from '@angular/core';
import { input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameTrainingComponent } from './game-training.component';
import { GameScoringGuideComponent } from './game-scoring-guide.component';
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
// 翻牌示範：挑比例接近方形的器物，牌面小也看得出差異（不放長卷）
const MEMORY_SAMPLES: MiniGameArtifact[] = [
  ['1337d4fe-6447-84fd-4115-000b60825b05', '剔紅番蓮紋瓶', 'lacquer/中漆000061N000000000'], ['ab0fd8e3-04ed-c5b8-51be-040763090373', '褐漆葵花式盤', 'lacquer/贈漆000006N000000000'],
  ['e42d52fe-d579-d929-94dd-045a8d469544', '有田窯五彩方盤', 'ceramic/故瓷009276N000000000'], ['4808dfa9-8de2-8d30-cf74-05f42b2850b7', '剔紅十六瓣盒', 'lacquer/中漆000039N000000000'],
  ['6c6944f5-09e8-2bf3-37e5-069f473c1c73', '玉神人', 'jade/故玉000024N000000000'], ['0d5ee27a-75e5-f401-d0e9-08080612147b', '掐絲琺瑯靶碗', 'enamel/中琺000009N000000000'],
  ['6769c966-acf8-4027-29fc-081b56671622', '白瓷花口碗', 'ceramic/中瓷005531N000000000'], ['e0e8fbc4-4d68-c1fd-4a61-0347c13d3fe6', '癭木蕉葉盤', 'carving/故雕000147N000000000']
].map(([artifactId, name, path]) => ({ artifactId, name, primaryImagePath: `/media/catalog/${path}/display.jpg`, thumbnailPath: null }));
const PAINTING_SAMPLE: MiniGameArtifact = { artifactId:'demo-painting', name:'東海道五十三次・戶塚', primaryImagePath:'/media/catalog/painting/南購畫00001600000/display.jpg', thumbnailPath:null };
// 入門定位題採用比例適中的原圖，避免長卷讓玩家先學放大與平移。
const LOCATOR_SAMPLES: MiniGameArtifact[] = [...SAMPLES.slice(0,3), PAINTING_SAMPLE];

/** 示範沿用正式控制器與盤面；只替換題目來源、存檔與結算出口。 */
@Component({
  selector: 'app-game-training-demo',
  imports: [RouterLink, GameTrainingPlaySheetComponent, GameScoringGuideComponent],
  templateUrl: './game-training-demo.component.html',
  styleUrl: './game-training-demo.component.scss'
})
export class GameTrainingDemoComponent extends GameTrainingComponent implements OnChanges {
  readonly modeCode = input.required<string>();
  private readonly demoDetector = inject(ChangeDetectorRef);
  private demoTimer: ReturnType<typeof setInterval> | null = null;
  private demoTicks = 0;
  private completionTicks = 0;
  autoPlaying = false;

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
    this.autoPlaying = false;
    this.demoTicks = 0;
    this.completionTicks = 0;
    const modeCode = this.modeCode();
    const modeName = ({ DETAIL_LOCATOR: '細節追跡', MEMORY_MATCH: '館藏翻牌', ARTIFACT_PUZZLE: '館藏拼圖', STRIP_RESTORE: '書畫拼貼' } as Record<string, string>)[modeCode] ?? '館藏挑戰';
    const target = modeCode === 'STRIP_RESTORE'
      ? PAINTING_SAMPLE
      : SAMPLES[0];
    this.beginAttempt({ attemptId: `demo-${modeCode}`, modeCode, modeName, ...target, artifactName: target.name,
      artifactPool: modeCode === 'DETAIL_LOCATOR' ? LOCATOR_SAMPLES : modeCode === 'MEMORY_MATCH' ? MEMORY_SAMPLES : SAMPLES,
      difficulty: 'EASY', seed: 'qmah-demo-v1-e', configJson: null, startedAt: new Date().toISOString() });
    this.demoTimer = setInterval(() => {
      if (this.paused || this.locatorReviewing || this.phase !== 'playing') return;
      this.demoTicks++;
      this.elapsedSeconds = Math.floor(this.demoTicks / 2);
      if (this.autoPlaying && this.demoTicks % 2 === 0) this.advanceDemo();
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
  protected override loadCatalogHints(attempt: MiniGameStart): void { if (attempt.modeCode === 'MEMORY_MATCH') super.loadCatalogHints(attempt); /* 其他示範的素材不是正式文物，不查詢。 */ }
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
       if (this.demoTicks % 6 === 0) this.playSheet?.advanceDemonstration();
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
