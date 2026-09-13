import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  EMPTY,
  Observable,
  Subscription,
  catchError,
  exhaustMap,
  finalize,
  forkJoin,
  map,
  of,
  switchMap,
  timer
} from 'rxjs';

import {
  GameAnswer,
  GameAnswerType,
  GameRoomDetails,
  GameRoomHistory,
  GameRoundDetails,
  MainGameReward
} from './game.models';
import { GameRoomResultsComponent } from './game-room-results.component';
import { GameService } from './game.service';

interface RoomSnapshot {
  room: GameRoomDetails;
  history: GameRoomHistory;
  round: GameRoundDetails | null;
}

@Component({
  selector: 'app-game-room',
  imports: [FormsModule, RouterLink, GameRoomResultsComponent],
  templateUrl: './game-room.component.html',
  styleUrl: './game-room.component.scss'
})
export class GameRoomComponent implements OnInit, OnDestroy {
  readonly game = inject(GameService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private pollSubscription?: Subscription;
  private clockSubscription?: Subscription;

  roomId = '';
  room: GameRoomDetails | null = null;
  history: GameRoomHistory | null = null;
  round: GameRoundDetails | null = null;
  currentPlayerId = '';
  loading = true;
  refreshing = false;
  refreshError = '';
  roundLoadError = '';
  actionError = '';
  actionMessage = '';
  answerText = '';
  answerType: GameAnswerType = 'FACTUAL_REASONING';
  voteCount = 1;
  now = Date.now();
  submittingAnswer = false;
  votingForAnswerId = '';
  rewarding = false;
  reward: MainGameReward | null = null;
  votedAnswerIds = new Set<string>();
  private lastRoundId = '';
  private submittedRoundId = '';

  readonly voteOptions = [1, 2, 3, 4, 5];
  readonly answerTypes: { value: GameAnswerType; label: string; hint: string }[] = [
    { value: 'FACTUAL_REASONING', label: '根據線索推理', hint: '提出你認為合理的真實解釋。' },
    { value: 'PLAUSIBLE_FICTION', label: '看似可信的猜想', hint: '試著寫一個有說服力的說法。' },
    { value: 'CREATIVE_TALE', label: '創意故事', hint: '用一段短故事描述這件館藏。' }
  ];

  ngOnInit(): void {
    this.roomId = this.route.snapshot.paramMap.get('roomId') ?? '';
    if (!this.roomId) {
      void this.router.navigate(['/game']);
      return;
    }
    this.restorePlayerId();
    this.pollSubscription = timer(0, 5000)
      .pipe(exhaustMap(() => this.loadSnapshot()))
      .subscribe((snapshot) => {
        this.room = snapshot.room;
        this.history = snapshot.history;
        this.round = snapshot.round;
        this.refreshError = '';
        if (this.round?.id !== this.lastRoundId) {
          this.lastRoundId = this.round?.id ?? '';
          this.restoreVotedAnswers();
        }
        this.changeDetector.markForCheck();
      });
    this.clockSubscription = timer(0, 1000).subscribe(() => {
      this.now = Date.now();
      this.changeDetector.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.pollSubscription?.unsubscribe();
    this.clockSubscription?.unsubscribe();
  }

  statusText(status: GameRoomDetails['status']): string {
    return {
      WAITING: '等待開始',
      PLAYING: '進行中',
      COMPLETED: '已完成',
      CANCELLED: '已取消'
    }[status];
  }

  phaseText(status: GameRoundDetails['status']): string {
    return { ANSWERING: '作答時間', VOTING: '投票時間', REVEALED: '本回合揭曉' }[status];
  }

  playerStateText(player: GameRoomDetails['players'][number]): string {
    if (player.role === 'HOST') return '房主';
    return player.connectionStatus === 'ONLINE' ? '在線' : '暫離';
  }

  seatText(seatNo: number | null): string {
    return seatNo === null ? '—' : String(seatNo).padStart(2, '0');
  }

  answerTypeText(answerType: GameAnswerType): string {
    return this.answerTypes.find((item) => item.value === answerType)?.label ?? answerType;
  }

  countdownSeconds(): number {
    if (!this.round) return 0;
    if (this.round.status === 'ANSWERING') {
      return this.game.remainingSeconds(this.round.answerDeadlineAt, this.now);
    }
    if (this.round.status === 'VOTING') {
      return this.game.remainingSeconds(this.round.votingDeadlineAt, this.now);
    }
    return 0;
  }

  countdownText(): string {
    const seconds = this.countdownSeconds();
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }

  hasSubmittedAnswer(): boolean {
    if (!this.round) return false;
    return this.submittedRoundId === this.round.id
      || (!!this.currentPlayerId
        && this.round.answers.some((answer) => answer.gamePlayerId === this.currentPlayerId));
  }

  isOwnAnswer(answer: GameAnswer): boolean {
    return !!this.currentPlayerId && answer.gamePlayerId === this.currentPlayerId;
  }

  canVoteFor(answer: GameAnswer): boolean {
    return !!this.round
      && this.game.canVote(this.round, this.now)
      && !this.isOwnAnswer(answer)
      && !this.votedAnswerIds.has(answer.id);
  }

  submitAnswer(): void {
    if (!this.round || !this.game.canAnswer(this.round, this.now) || this.hasSubmittedAnswer()) return;
    this.actionError = '';
    this.actionMessage = '';
    this.submittingAnswer = true;
    this.game.submitAnswer(this.round.id, { answerType: this.answerType, text: this.answerText })
      .pipe(finalize(() => {
        this.submittingAnswer = false;
        this.changeDetector.markForCheck();
      }))
      .subscribe({
        next: (answer) => {
          this.currentPlayerId = answer.gamePlayerId;
          this.rememberPlayerId();
          this.submittedRoundId = this.round?.id ?? '';
          this.answerText = '';
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          this.actionError = this.game.errorMessage(error);
          this.changeDetector.markForCheck();
        }
      });
  }

  submitVote(answer: GameAnswer): void {
    if (!this.round || !this.canVoteFor(answer)) return;
    this.actionError = '';
    this.actionMessage = '';
    this.votingForAnswerId = answer.id;
    this.game.submitVote(this.round.id, { answerId: answer.id, count: this.voteCount })
      .pipe(finalize(() => {
        this.votingForAnswerId = '';
        this.changeDetector.markForCheck();
      }))
      .subscribe({
        next: () => {
          this.votedAnswerIds.add(answer.id);
          this.rememberVotedAnswers();
          this.actionMessage = `已投給「${answer.playerDisplayName}」的回答。`;
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          this.actionError = this.game.errorMessage(error);
          this.changeDetector.markForCheck();
        }
      });
  }

  claimReward(): void {
    if (!this.room || this.room.status !== 'COMPLETED' || this.rewarding) return;
    this.actionError = '';
    this.actionMessage = '';
    this.rewarding = true;
    this.game.rewardMainGame(this.room.id)
      .pipe(finalize(() => {
        this.rewarding = false;
        this.changeDetector.markForCheck();
      }))
      .subscribe({
        next: (reward) => {
          this.reward = reward;
          this.actionMessage = reward.alreadyRewarded
            ? '這間房的獎勵已領取。'
            : '多人遊戲獎勵已入帳。';
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          this.actionError = this.game.errorMessage(error);
          this.changeDetector.markForCheck();
        }
      });
  }

  private loadSnapshot(): Observable<RoomSnapshot> {
    this.loading = !this.room;
    this.refreshing = true;
    return forkJoin({
      room: this.game.getRoom(this.roomId),
      history: this.game.getRoomHistory(this.roomId)
    }).pipe(
      switchMap(({ room, history }): Observable<RoomSnapshot> => {
        const currentRound = room.status === 'PLAYING'
          ? history.rounds.find((item) => item.roundNumber === room.currentRoundNo)
          : undefined;
        if (!currentRound) {
          this.roundLoadError = '';
          return of({ room, history, round: null });
        }
        this.roundLoadError = '';
        return this.game.getRound(currentRound.id).pipe(
          map((round): RoomSnapshot => ({ room, history, round })),
          catchError((error: unknown) => {
            this.roundLoadError = this.game.errorMessage(error);
            return of({ room, history, round: null });
          })
        );
      }),
      catchError((error: unknown) => {
        this.refreshError = this.game.errorMessage(error);
        return EMPTY;
      }),
      finalize(() => {
        this.loading = false;
        this.refreshing = false;
        this.changeDetector.markForCheck();
      })
    );
  }

  private restorePlayerId(): void {
    const navigationId = this.router.getCurrentNavigation()?.extras.state?.['playerId'];
    if (typeof navigationId === 'string' && navigationId) {
      this.currentPlayerId = navigationId;
      this.rememberPlayerId();
      return;
    }
    try {
      this.currentPlayerId = sessionStorage.getItem(this.playerStorageKey()) ?? '';
    } catch {
      this.currentPlayerId = '';
    }
  }

  private rememberPlayerId(): void {
    if (!this.currentPlayerId) return;
    try { sessionStorage.setItem(this.playerStorageKey(), this.currentPlayerId); } catch { /* Storage can be disabled. */ }
  }

  private restoreVotedAnswers(): void {
    this.votedAnswerIds = new Set<string>();
    if (!this.currentPlayerId || !this.round) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(this.voteStorageKey()) ?? '[]') as unknown;
      if (Array.isArray(saved)) {
        this.votedAnswerIds = new Set(saved.filter((item): item is string => typeof item === 'string'));
      }
    } catch {
      this.votedAnswerIds = new Set<string>();
    }
  }

  private rememberVotedAnswers(): void {
    if (!this.currentPlayerId || !this.round) return;
    try {
      sessionStorage.setItem(this.voteStorageKey(), JSON.stringify([...this.votedAnswerIds]));
    } catch { /* Storage can be disabled. */ }
  }

  private playerStorageKey(): string { return `qmah-game-player:${this.roomId}`; }
  private voteStorageKey(): string {
    return `qmah-game-votes:${this.roomId}:${this.currentPlayerId}:${this.round?.id ?? ''}`;
  }
}
