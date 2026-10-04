import { GameAudio } from './game-audio.service';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MiniGameArtifact, MiniGameComplete, MiniGameStart } from './game.models';
import { GameRewardMeterComponent } from './game-reward-meter.component';
import { GameScrollPanelComponent } from './game-scroll-panel.component';

@Component({
  selector: 'app-game-training-result',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, GameRewardMeterComponent, GameScrollPanelComponent],
  templateUrl: './game-training-result.component.html',
  styleUrl: './game-training-result.component.scss'
})
export class GameTrainingResultComponent {
  private readonly victory = inject(GameAudio).play('win');
  readonly attempt = input.required<MiniGameStart>();
  readonly complete = input.required<MiniGameComplete>();
  readonly title = input.required<string>();
  readonly artifacts = input<MiniGameArtifact[]>([]);
  readonly elapsedLabel = input('00:00');
  readonly moves = input(0);
  readonly hintsUsed = input(0);
  readonly autoPlaced = input(0);
  readonly starting = input(false);
  readonly failedImageKeys = input<string[]>([]);

  readonly playAgain = output<void>();
  readonly showModeList = output<void>();
  readonly imageFailed = output<string>();

  imageUnavailable(key: string): boolean { return this.failedImageKeys().includes(key); }
}
