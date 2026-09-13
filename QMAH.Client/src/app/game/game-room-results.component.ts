import { Component, input, output } from '@angular/core';

import { GameRoomHistory, MainGameReward } from './game.models';

@Component({
  selector: 'app-game-room-results',
  templateUrl: './game-room-results.component.html',
  styleUrl: './game-room-results.component.scss'
})
export class GameRoomResultsComponent {
  readonly history = input<GameRoomHistory | null>(null);
  readonly reward = input<MainGameReward | null>(null);
  readonly rewarding = input(false);
  readonly claimReward = output<void>();
}
