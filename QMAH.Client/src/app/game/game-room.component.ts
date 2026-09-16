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
  history: GameRoomHistory | null;
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
  private heartbeatSubscription?: Subscription;

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
  lobbyActionBusy = false;
  leaving = false;
  rewarding = false;
  reward: MainGameReward | null = null;
  artifactImageUnavailable = false;
  votedAnswerIds = new Set<string>();
  private lastRoundId = '';
  private submittedRoundId = '';

  readonly voteOptions = [1, 2, 3];
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
    this.pollSubscription = timer(0, 5000)
      .pipe(exhaustMap(() => this.loadSnapshot()))
      .subscribe((snapshot) => {
        const playerChanged = this.currentPlayerId !== (snapshot.room.currentPlayerId ?? '');
        this.currentPlayerId = snapshot.round?.currentPlayerId ?? snapshot.room.currentPlayerId ?? '';
        this.room = snapshot.room;
        this.history = snapshot.history;
        this.round = snapshot.round;
        this.refreshError = '';
        if (playerChanged || this.round?.id !== this.lastRoundId) {
          this.lastRoundId = this.round?.id ?? '';
          this.artifactImageUnavailable = false;
          this.restoreVotedAnswers();
        }
        this.changeDetector.markForCheck();
      });
    this.heartbeatSubscription = timer(15000, 15000)
      .pipe(exhaustMap(() => this.currentPlayerId
        ? this.game.heartbeat(this.roomId).pipe(catchError(() => EMPTY))
        : EMPTY))
      .subscribe();
    this.clockSubscription = timer(0, 1000).subscribe(() => {
      this.now = Date.now();
      this.changeDetector.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.pollSubscription?.unsubscribe();
    this.clockSubscription?.unsubscribe();
    this.heartbeatSubscription?.unsubscribe();
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
    if (player.connectionStatus !== 'ONLINE') return '暫離';
    const readiness = player.isReady ? '已準備' : '尚未準備';
    return player.role === 'HOST' ? `房主・${readiness}` : readiness;
  }

  canStartRoom(): boolean {
    if (!this.room || !this.currentPlayer()) return false;
    return this.currentPlayer()?.role === 'HOST'
      && this.room.players.length >= 2
      && this.room.players.every((player) => player.connectionStatus === 'ONLINE' && player.isReady);
  }

  currentPlayer(): GameRoomDetails['players'][number] | null {
    return this.room?.players.find((player) => player.id === this.currentPlayerId) ?? null;
  }

  setReady(): void {
    const player = this.currentPlayer();
    if (!this.room || this.room.status !== 'WAITING' || !player || this.lobbyActionBusy) return;
    this.actionError = '';
    this.lobbyActionBusy = true;
    this.game.setReady(this.room.id, !player.isReady).pipe(finalize(() => {
      this.lobbyActionBusy = false;
      this.changeDetector.markForCheck();
    })).subscribe({
      next: (room) => {
        this.room = room;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.actionError = this.game.errorMessage(error);
        this.changeDetector.markForCheck();
      }
    });
  }

  startGame(): void {
    if (!this.room || this.lobbyActionBusy || !this.canStartRoom()) return;
    this.actionError = '';
    this.lobbyActionBusy = true;
    this.game.startRoom(this.room.id).pipe(finalize(() => {
      this.lobbyActionBusy = false;
      this.changeDetector.markForCheck();
    })).subscribe({
      next: (room) => {
        this.room = room;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.actionError = this.game.errorMessage(error);
        this.changeDetector.markForCheck();
      }
    });
  }

  leaveRoom(): void {
    if (!this.room || this.leaving) return;
    this.actionError = '';
    this.leaving = true;
    this.game.leaveRoom(this.room.id).pipe(finalize(() => {
      this.leaving = false;
      this.changeDetector.markForCheck();
    })).subscribe({
      next: () => void this.router.navigate(['/game']),
      error: (error: unknown) => {
        this.actionError = this.game.errorMessage(error);
        this.changeDetector.markForCheck();
      }
    });
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
    return !!this.currentPlayerId
      && !!this.round
      && this.game.canVote(this.round, this.now)
      && !this.isOwnAnswer(answer)
      && !this.votedAnswerIds.has(answer.id);
  }

  submitAnswer(): void {
    if (!this.currentPlayerId || !this.round || !this.game.canAnswer(this.round, this.now) || this.hasSubmittedAnswer()) return;
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
    return this.game.getRoom(this.roomId).pipe(
      switchMap((room): Observable<RoomSnapshot> => {
        if (room.status === 'COMPLETED') {
          return this.game.getRoomHistory(this.roomId).pipe(
            map((history): RoomSnapshot => ({ room, history, round: null }))
          );
        }
        if (room.status !== 'PLAYING' || !room.currentRoundId) {
          this.roundLoadError = '';
          return of({ room, history: null, round: null });
        }
        this.roundLoadError = '';
        return this.game.getRound(room.currentRoundId).pipe(
          map((round): RoomSnapshot => ({ room, history: null, round })),
          catchError((error: unknown) => {
            this.roundLoadError = this.game.errorMessage(error);
            return of({ room, history: null, round: null });
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

  private restoreVotedAnswers(): void {
    this.votedAnswerIds = new Set(this.round?.votedAnswerIds ?? []);
  }
}
