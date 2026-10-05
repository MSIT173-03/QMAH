import { ChangeDetectionStrategy, computed, Component, ElementRef, ViewChild, input, output, signal } from '@angular/core';

import { MiniGameArtifact, MiniGameStart } from './game.models';
import { GameDetailLocatorBoardComponent } from './game-detail-locator-board.component';
import { LocatorAnswer } from './game-detail-locator';
import { GamePlacementBoardComponent } from './game-placement-board.component';
import { GameScrollBoardComponent } from './game-scroll-board.component';

export interface TrainingMemoryCard {
  id: string;
  artifactId: string;
  name: string;
  image: string;
  revealed: boolean;
  matched: boolean;
}

export interface TrainingCatalogHint {
  artifactId: string;
  name: string;
  description: string | null;
}

@Component({
  selector: 'app-game-training-play-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GameDetailLocatorBoardComponent, GamePlacementBoardComponent, GameScrollBoardComponent],
  templateUrl: './game-training-play-sheet.component.html',
  styleUrl: './game-training-play-sheet.component.scss'
})
export class GameTrainingPlaySheetComponent {
  readonly attempt = input.required<MiniGameStart>();
  // 館藏拼圖的「只看十秒」玩法：伺服器把玩法記在 seed 尾端（-m）；試玩不套用。
  readonly puzzleMemory = computed(() => !this.demonstration() && this.attempt().seed.endsWith('-m'));
  readonly isComplete = input(false);
  readonly demonstration = input(false);
  readonly paused = input(false);
  readonly completing = input(false);
  readonly resultFrozen = input(false);
  readonly imageUnavailable = input(false);
  readonly failedImageKeys = input<string[]>([]);
  readonly locatorOptions = input<MiniGameArtifact[]>([]);
  readonly locatorCropX = input(.5);
  readonly locatorCropY = input(.5);
  readonly locatorAnswers = input<LocatorAnswer[]>([]);
  readonly locatorHintArtifactId = input<string | null>(null);
  readonly locatorExcludedIds = input<string[]>([]);
  readonly memoryCards = input<TrainingMemoryCard[]>([]);
  readonly memoryBusy = input(false);
  readonly memoryMatched = input(0);
  readonly memoryPairCount = input(0);
  readonly memoryFeedback = input('');
  readonly moves = input(0);
  readonly puzzleOrder = input<number[]>([]);
  readonly puzzleSelection = input<number | null>(null);
  readonly puzzleHintRegion = input<number | null>(null);
  readonly restoreOrder = input<number[]>([]);
  readonly restoreSelection = input<number | null>(null);
  readonly restoreHintRegion = input<number | null>(null);
  readonly autoPlaced = input(0);
  readonly isRestoreSolved = input(false);
  readonly memoryHints = input<TrainingCatalogHint[]>([]);
  /** 本局翻牌用到的文物（每件一筆），電腦版側欄點開可看介紹。 */
  readonly memoryDeck = computed(() => {
    const seen = new Map<string, { artifactId: string; name: string; image: string | null; description: string }>();
    for (const card of this.memoryCards()) {
      if (!seen.has(card.artifactId)) seen.set(card.artifactId, { artifactId: card.artifactId, name: card.name, image: card.image ?? null, description: this.memoryHints().find(hint => hint.artifactId === card.artifactId)?.description ?? '' });
    }
    return [...seen.values()];
  });
  readonly deckPick = signal<string | null>(null);
  readonly deckPicked = computed(() => this.memoryDeck().find(item => item.artifactId === this.deckPick()) ?? null);
  readonly currentArtifactHint = input<TrainingCatalogHint | null>(null);
  readonly progressPercent = input(0);
  readonly elapsedLabel = input('00:00');
  readonly progressText = input('');
  readonly canAskForHelp = input(false);
  readonly canComplete = input(false);

  readonly pauseRequested = output<void>();
  readonly helpRequested = output<void>();
  readonly completeRequested = output<void>();
  readonly detailLocated = output<LocatorAnswer>();
  readonly locatorFeedback = output<boolean>();
  readonly boardFocusMove = output<{ event: KeyboardEvent; slot: number; columns: number }>();
  readonly imageError = output<string>();
  readonly memoryFlipped = output<number>();
  readonly puzzleOrderChange = output<number[]>();
  readonly restoreOrderChange = output<number[]>();
  readonly moveMade = output<void>();
  readonly hintUsed = output<void>();
  readonly autoCompleted = output<number>();
  readonly settlementRequested = output<void>();
  readonly locatorAvailability = output<boolean>();
  readonly puzzleAvailability = output<boolean>();
  readonly scrollAvailability = output<boolean>();

  @ViewChild(GamePlacementBoardComponent) private placement?: GamePlacementBoardComponent;
  @ViewChild(GameScrollBoardComponent) private scrollBoard?: GameScrollBoardComponent;
  @ViewChild(GameDetailLocatorBoardComponent) private locatorBoard?: GameDetailLocatorBoardComponent;
  locatorDimensions(): { imageWidth: number; imageHeight: number } | null { return this.locatorBoard?.dimensions() ?? null; }

  difficultyText(difficulty: string): string {
    return { EASY: '簡單', NORMAL: '一般', HARD: '困難', EXPERT: '專家' }[difficulty?.trim().toUpperCase()] ?? '一般';
  }
  imageFailed(key: string): boolean { return this.failedImageKeys().includes(key); }
  advanceDemonstration(): void {
    if (!this.demonstration() || this.paused() || this.resultFrozen()) return;
    if (this.attempt().modeCode === 'DETAIL_LOCATOR') this.locatorBoard?.advanceDemonstration();
    else if (this.attempt().modeCode === 'ARTIFACT_PUZZLE') this.placement?.advanceDemonstration();
    else this.scrollBoard?.advanceDemonstration();
  }
  readonly hard = input(false);
  /** 困難玩法沒有求救（拼圖除外）。 */
  readonly helpAvailable = input(true);
  puzzleReady(): boolean { return !!this.placement?.ready(); }
  scrollReady(): boolean { return !!this.scrollBoard?.ready(); }
  scrollEligible(): boolean { return !!this.scrollBoard?.layout().eligible; }
  placementState(): { selection: number | null; hintRegion: number | null } | null {
    return this.placement ? { selection: this.placement.selected(), hintRegion: this.placement.hintRegion() } : null;
  }
  scrollState(): { selection: number | null; hintRegion: number | null } | null {
    return this.scrollBoard ? { selection: this.scrollBoard.selected, hintRegion: this.scrollBoard.hintRegion } : null;
  }
  requestPuzzleHelp(automatic: boolean): void { if (automatic) this.placement?.autoFinish(); else this.placement?.requestHint(); }
  requestScrollHelp(automatic: boolean): void { if (automatic) this.scrollBoard?.finishWithHelp(); else this.scrollBoard?.requestHint(); }

  onBoardFocusMove(event: KeyboardEvent, slot: number, columns: number): void {
    this.boardFocusMove.emit({ event, slot, columns });
  }
}
