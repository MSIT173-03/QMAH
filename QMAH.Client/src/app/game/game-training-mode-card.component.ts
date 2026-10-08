import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MiniGameMode } from './game.models';

@Component({
  selector: 'app-game-training-mode-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-training-mode-card.component.html',
  styleUrl: './game-training-mode-card.component.scss'
})
export class GameTrainingModeCardComponent {
  readonly mode = input.required<MiniGameMode>();
  readonly mechanic = input.required<readonly [string, string]>();
  readonly selected = input(false);
  readonly disabled = input(false);
  readonly modeSelected = output<string>();

  readonly previewMemory = Array.from({ length: 16 }, (_, index) => [2, 5, 10, 13].includes(index));
  readonly previewPuzzle = Array.from({ length: 25 });
  readonly previewScroll = Array.from({ length: 15 });

  previewImage(): string {
    return this.mode().code === 'STRIP_RESTORE'
      ? '/media/catalog/painting/南購畫00001600000/display.jpg'
      : this.mode().code === 'ARTIFACT_PUZZLE'
        ? '/assets/game/ceramic-square-vase.jpg'
        : '/images/login/real/cloisonne-tripod-incense-burner.jpg';
  }
}
