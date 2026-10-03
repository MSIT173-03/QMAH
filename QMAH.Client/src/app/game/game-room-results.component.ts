import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameRoomHistory, MainGameReward } from './game.models';
import { GameRewardMeterComponent } from './game-reward-meter.component';
import { GameScrollPanelComponent } from './game-scroll-panel.component';

@Component({
  selector:'app-game-room-results',
  imports:[RouterLink, GameRewardMeterComponent, GameScrollPanelComponent],
  templateUrl:'./game-room-results.component.html',
  styleUrl:'./game-room-results.component.scss'
})
export class GameRoomResultsComponent {
  readonly history = input<GameRoomHistory | null>(null);
  readonly reward = input<MainGameReward | null>(null);
  readonly rewarding = input(false);
  readonly canClaim = input(true);
  readonly rehearsal = input(false);
  readonly scenario = input('');
  readonly currentPlayerId = input('');
  readonly ownResult = computed(() => this.history()?.leaderboard.find(entry => entry.gamePlayerId === this.currentPlayerId()) ?? null);
  readonly leaders = computed(() => this.history()?.leaderboard.filter(entry => entry.rank === 1 && entry.score > 0) ?? []);
  readonly claimReward = output<void>();
}
