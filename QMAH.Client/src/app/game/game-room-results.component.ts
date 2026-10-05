import { GameAudio } from './game-audio.service';
import { Component, computed, inject, input, output, signal } from '@angular/core';
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
  private readonly victory = inject(GameAudio).play('win');
  readonly history = input<GameRoomHistory | null>(null);
  readonly reward = input<MainGameReward | null>(null);
  readonly rewarding = input(false);
  readonly canClaim = input(true);
  readonly rehearsal = input(false);
  readonly scenario = input('');
  readonly currentPlayerId = input('');
  readonly ownResult = computed(() => this.history()?.leaderboard.find(entry => entry.gamePlayerId === this.currentPlayerId()) ?? null);
  readonly leaders = computed(() => this.history()?.leaderboard.filter(entry => entry.rank === 1 && entry.score > 0) ?? []);
  readonly picked = signal(0);
  readonly round = computed(() => { const rounds = this.history()?.rounds ?? []; return rounds[Math.min(this.picked(), rounds.length - 1)] ?? null; });
  readonly myAnswers = computed(() => (this.history()?.rounds ?? []).map(round => ({ round, answer: round.answers.find(a => a.gamePlayerId === this.currentPlayerId()) ?? null })));
  maxVotes(answers: { voteCount: number }[]): number { return Math.max(1, ...answers.map(a => a.voteCount)); }
  readonly claimReward = output<void>();
}
