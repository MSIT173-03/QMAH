import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, input, output } from '@angular/core';

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
