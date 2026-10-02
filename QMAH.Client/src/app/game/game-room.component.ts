import { ChangeDetectorRef, Component, DestroyRef, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
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
  GameRoundSummary,
  MainGameReward,
  GameRehearsalMaterial,
  GameRoomListItem,
  GameRoomPresentation,
  GameRoomChatMessage
} from './game.models';
import { GameRoomResultsComponent } from './game-room-results.component';
import { GameAnswerTableComponent } from './game-answer-table.component';
import { GameRoomChatComponent } from './game-room-chat.component';
import { GameFocusMode } from '../core/services/game-focus-mode';
import { QmahIconComponent } from '../shared/components/qmah-icon/qmah-icon';
import { GameService } from './game.service';

interface RoomSnapshot {
  room: GameRoomDetails;
  history: GameRoomHistory | null;
  round: GameRoundDetails | null;
  presentation?: GameRoomPresentation;
}

type TestStage = 'WAITING' | 'ANSWERING' | 'VOTING' | 'REVEALED' | 'COMPLETED';

interface TestScenario {
  roomCode: string;
  totalRounds: number;
  waitingSeconds: number;
  answerSeconds: number;
  votingSeconds: number;
  revealSeconds: number;
}

@Component({
  selector: 'app-game-room',
  imports: [FormsModule, RouterLink, GameRoomResultsComponent, GameAnswerTableComponent, GameRoomChatComponent, QmahIconComponent],
  templateUrl: './game-room.component.html',
  styleUrl: './game-room.component.scss'
})
export class GameRoomComponent implements OnInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  readonly game = inject(GameService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly gameFocus = inject(GameFocusMode);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private previousFocusMode = false;
  selectedSeatId = '';
  private pollSubscription?: Subscription;
  private clockSubscription?: Subscription;
  private heartbeatSubscription?: Subscription;
  private readonly connectionId = crypto.randomUUID();
  playerColors: Record<string, string> = {};
  chatMessages: GameRoomChatMessage[] = [];
  chatSending = false;
  chatError = '';
  colorBusy = false;
  readonly cardColors = ['jade', 'blue', 'vermilion', 'gold', 'violet', 'teal', 'rose', 'slate', 'olive', 'copper', 'indigo', 'sand'];
  testStage: TestStage = 'WAITING';
  private testStageEndsAt = 0;
  private testScenario: TestScenario | null = null;
  private testRounds: GameRoundDetails[] = [];
  private testSubmittedAnswer: GameAnswer | null = null;
  private testPausedRemainingMs = 0;
  private readonly testSelfId = 'test-player-self';
  private testMaterials: GameRehearsalMaterial[] = [];
  private testPlayerNames: string[] = [];
  private testRoomOptions?: GameRoomListItem;
  private testCurrentPlayerName = '玩家';
  private testBotPlans: { answer: GameAnswer; readyAt: number; submitted: boolean }[] = [];
  private testPausedAt = 0;

  roomId = '';
  room: GameRoomDetails | null = null;
  history: GameRoomHistory | null = null;
  round: GameRoundDetails | null = null;
  currentPlayerId = '';
  loading = true;
  refreshing = false;
  refreshError = '';
  needsGameAccount = false;
  roundLoadError = '';
  actionError = '';
  actionMessage = '';
  answerText = '';
  answerType: GameAnswerType = 'FACTUAL_REASONING';
  now = Date.now();
  submittingAnswer = false;
  votingForAnswerId = '';
  lobbyActionBusy = false;
  leaving = false;
  showLeaveConfirm = false;
  @ViewChild('leaveDialog') private leaveDialog?: ElementRef<HTMLElement>;
  private leaveDialogTrigger: HTMLElement | null = null;
  rewarding = false;
  reward: MainGameReward | null = null;
  artifactImageUnavailable = false;
  votedAnswerIds = new Set<string>();
  testMode = false;
  testToolsOpen = false;
  testAutoPaused = false;
  private lastRoundId = '';
  private submittedRoundId = '';

  readonly answerTypes: { value: GameAnswerType; label: string; hint: string }[] = [
    { value: 'FACTUAL_REASONING', label: '史實推理', hint: '推測真正的名稱、用途、年代或背景。' },
    { value: 'PLAUSIBLE_FICTION', label: '擬真異說', hint: '寫出看似合理、實際虛構的文物說明。' },
    { value: 'CREATIVE_TALE', label: '妙想奇談', hint: '寫一段幽默、誇張或有故事性的回答。' }
  ];

  ngOnInit(): void {
    this.previousFocusMode = this.gameFocus.active();
    this.gameFocus.active.set(true);
    this.roomId = this.route.snapshot.paramMap.get('roomId') ?? '';
    if (!this.roomId) {
      void this.router.navigate(['/game']);
      return;
    }

    // ui-integration: 測試模式由受保護的正式 route 授權，房間畫面只負責重用正式 UI 並切換到隔離資料流。
    this.testMode = this.route.snapshot.queryParamMap.get('test') === '1';
    if (this.testMode) {
      // ui-integration: 測試房間重用正式房間畫面，但在元件內隔離資料與計時器，避免測試污染會員、房間或獎勵紀錄。
      this.initializeTestFlow();
      this.clockSubscription = timer(0, 1000).subscribe(() => {
        if (!this.testMode || !this.testAutoPaused) this.now = Date.now();
        this.advanceTestFlow();
        this.changeDetector.markForCheck();
      });
      return;
    }

    // 房間生命週期每兩秒更新；同步頻率一致可減少換階段後仍顯示舊畫面的時間。
    this.pollSubscription = timer(0, 2000)
      .pipe(exhaustMap(() => this.loadSnapshot()))
      .subscribe((snapshot) => {
        const playerChanged = this.currentPlayerId !== (snapshot.room.currentPlayerId ?? '');
        this.currentPlayerId = snapshot.round?.currentPlayerId ?? snapshot.room.currentPlayerId ?? '';
        this.room = snapshot.room;
        this.history = snapshot.history;
        this.round = snapshot.round;
        if (snapshot.presentation) {
          this.playerColors = snapshot.presentation.colors;
          this.chatMessages = snapshot.presentation.messages;
        }
        this.refreshError = '';
        this.needsGameAccount = false;
        if (playerChanged || this.round?.id !== this.lastRoundId) {
          this.lastRoundId = this.round?.id ?? '';
          this.restoreDraft();
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
    this.gameFocus.active.set(this.previousFocusMode);
    this.saveDraft(this.answerText);
    this.pollSubscription?.unsubscribe();
    this.clockSubscription?.unsubscribe();
    this.heartbeatSubscription?.unsubscribe();
    if (!this.testMode && this.currentPlayerId) {
      this.game.disconnectRoomPresentation(this.roomId, this.connectionId).pipe(catchError(() => EMPTY)).subscribe();
    }
  }

  openRoomPanel(panel: string): void {
    this.host.nativeElement.querySelector<HTMLDialogElement>(`dialog[data-panel="${panel}"]`)?.showModal();
  }

  closeRoomPanel(panel: string): void {
    this.host.nativeElement.querySelector<HTMLDialogElement>(`dialog[data-panel="${panel}"]`)?.close();
  }

  inspectSeat(id: string): void {
    this.selectedSeatId = id;
    this.openRoomPanel('seat');
  }

  selectedSeat() { return this.room?.players.find(player => player.id === this.selectedSeatId); }

  isRoomFocused(): boolean { return this.gameFocus.active(); }

  toggleRoomFocus(): void { this.gameFocus.toggle(); }

  seatColor(id: string): string {
    const colors: Record<string, string> = { jade: '#376d62', blue: '#406591', vermilion: '#a43f34', gold: '#806020', violet: '#66528f', teal: '#216c69', rose: '#a04660', slate: '#506471', olive: '#56682f', copper: '#92552e', indigo: '#435293', sand: '#806139' };
    return colors[this.playerColors[id]] ?? '#376d62';
  }

  seatPosition(player: GameRoomDetails['players'][number], players: GameRoomDetails['players'], capacity: number): string {
    if (player.id === this.currentPlayerId) return 'self';

    const self = players.find(candidate => candidate.id === this.currentPlayerId);
    const seatNo = (candidate: GameRoomDetails['players'][number]): number => candidate.seatNo ?? players.indexOf(candidate) + 1;
    const selfSeat = self ? seatNo(self) : 1;
    const opponents = players
      .filter(candidate => candidate.id !== this.currentPlayerId)
      .sort((left, right) => {
        const leftSeat = ((seatNo(left) - selfSeat + capacity) % capacity + capacity) % capacity;
        const rightSeat = ((seatNo(right) - selfSeat + capacity) % capacity + capacity) % capacity;
        return leftSeat - rightSeat;
      });
    const index = opponents.findIndex(candidate => candidate.id === player.id);
    const layouts: Record<number, string[]> = {
      1: ['top-center'],
      2: ['top-left', 'top-right'],
      3: ['top-left', 'top-center', 'top-right'],
      4: ['bottom-right', 'top-right', 'top-left', 'bottom-left'],
      5: ['bottom-right', 'middle-right', 'top-center', 'middle-left', 'bottom-left']
    };
    return layouts[opponents.length]?.[index] ?? 'top-center';
  }

  sendChat(text: string): void {
    if (this.chatSending || !this.currentPlayerId || !text.trim() || text.length > 500) return;
    this.chatError = '';
    if (this.testMode) {
      if (this.chatMessages.length >= 100) { this.chatError = '本房間已達 100 則訊息。'; return; }
      this.chatMessages = [...this.chatMessages, { id: crypto.randomUUID(), gamePlayerId: this.currentPlayerId,
        displayName: this.testCurrentPlayerName, text: text.trim(), sentAt: new Date().toISOString() }];
      return;
    }
    this.chatSending = true;
    this.game.sendRoomMessage(this.roomId, text.trim(), crypto.randomUUID()).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => { this.chatSending = false; this.changeDetector.markForCheck(); })
    ).subscribe({
      next: message => { if (!this.chatMessages.some(item => item.id === message.id)) this.chatMessages = [...this.chatMessages, message]; },
      error: error => { this.chatError = this.game.errorMessage(error); }
    });
  }

  chooseCardColor(color: string): void {
    if (this.colorBusy || this.room?.status !== 'WAITING' || !this.currentPlayerId) return;
    if (this.testMode) {
      if (!this.isCardColorTaken(color)) this.playerColors = { ...this.playerColors, [this.currentPlayerId]: color };
      return;
    }
    this.colorBusy = true;
    this.game.setRoomColor(this.roomId, color).pipe(takeUntilDestroyed(this.destroyRef),
      finalize(() => { this.colorBusy = false; this.changeDetector.markForCheck(); })).subscribe({
      next: presentation => { this.playerColors = presentation.colors; },
      error: error => { this.actionError = this.game.errorMessage(error); }
    });
  }

  isCardColorTaken(color: string): boolean {
    return Object.entries(this.playerColors).some(([id, chosen]) => id !== this.currentPlayerId && chosen === color);
  }

  private draftKey(roundId = this.round?.id): string {
    return `qmah-game-draft:${this.roomId}:${roundId}:${this.currentPlayerId}`;
  }
  saveDraft(text: string): void {
    if (this.testMode || !this.round || !this.currentPlayerId || this.hasSubmittedAnswer()) return;
    try { sessionStorage.setItem(this.draftKey(), text.slice(0, 500)); } catch { /* storage is optional */ }
  }
  private restoreDraft(): void {
    this.answerText = '';
    if (this.testMode || !this.round || !this.currentPlayerId || this.hasSubmittedAnswer()) return;
    try { this.answerText = sessionStorage.getItem(this.draftKey())?.slice(0, 500) ?? ''; } catch { /* storage is optional */ }
  }
  private clearDraft(roundId: string): void {
    try { sessionStorage.removeItem(this.draftKey(roundId)); } catch { /* storage is optional */ }
  }

  testStageText(): string {
    return {
      WAITING: '準備房間中',
      ANSWERING: '作答階段',
      VOTING: '投票階段',
      REVEALED: '結果揭曉',
      COMPLETED: '測試結算'
    }[this.testStage];
  }

  toggleTestTools(): void {
    if (!this.testMode) return;
    this.testToolsOpen = !this.testToolsOpen;
    this.changeDetector.markForCheck();
  }

  toggleTestAuto(): void {
    if (!this.testMode || this.testStage === 'COMPLETED') return;
    if (!this.testAutoPaused) {
      this.testPausedAt = Date.now();
      this.testPausedRemainingMs = Math.max(0, this.testStageEndsAt - Date.now());
      this.now = Date.now();
      this.testAutoPaused = true;
    } else {
      const resumeAt = Date.now();
      const pausedFor = resumeAt - this.testPausedAt;
      for (const plan of this.testBotPlans) if (!plan.submitted) plan.readyAt += pausedFor;
      this.testStageEndsAt = resumeAt + this.testPausedRemainingMs;
      this.updateTestRoundDeadlines(resumeAt);
      this.now = resumeAt;
      this.testAutoPaused = false;
    }
    this.actionMessage = this.testAutoPaused ? '自動流程已暫停，可以逐步檢查目前畫面。' : '自動流程已繼續。';
    this.changeDetector.markForCheck();
  }

  skipTestStage(): void {
    if (!this.testMode || this.testStage === 'COMPLETED') return;
    // ui-integration: 「下一階段」只推進本機測試狀態，讓檢查員不必等待倒數，也不改變正式遊戲流程。
    this.advanceTestFlow(true);
    this.changeDetector.markForCheck();
  }

  restartTestFlow(): void {
    if (!this.testMode || this.loading) return;
    this.initializeTestFlow();
    this.changeDetector.markForCheck();
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

  startDisabledReason(): string {
    if (!this.room || !this.currentPlayer() || this.currentPlayer()?.role !== 'HOST') return '';
    if (this.room.players.length < 2) return '至少需要 2 位玩家才能開始。';
    if (!this.room.players.every((player) => player.connectionStatus === 'ONLINE' && player.isReady)) return '所有玩家都在線上並準備好後才能開始。';
    return '';
  }

  currentPlayer(): GameRoomDetails['players'][number] | null {
    return this.room?.players.find((player) => player.id === this.currentPlayerId) ?? null;
  }

  setReady(): void {
    const player = this.currentPlayer();
    if (!this.room || this.room.status !== 'WAITING' || !player || this.lobbyActionBusy) return;
    if (this.testMode) {
      player.isReady = !player.isReady;
      this.actionMessage = player.isReady ? '你已準備。' : '你已取消準備。';
      this.changeDetector.markForCheck();
      return;
    }
    this.actionError = '';
    this.lobbyActionBusy = true;
    this.game.setReady(this.room.id, !player.isReady).pipe(finalize(() => {
      this.lobbyActionBusy = false;
      this.changeDetector.markForCheck();
    })).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (room) => {
        this.room = room;
        this.actionMessage = player.isReady ? '已取消準備。' : '已準備，等待房主開始遊戲。';
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
    if (this.testMode) {
      this.startTestRound(1);
      this.actionMessage = '遊戲已開始，正在進入第一回合。';
      this.changeDetector.markForCheck();
      return;
    }
    this.actionError = '';
    this.lobbyActionBusy = true;
    this.game.startRoom(this.room.id).pipe(finalize(() => {
      this.lobbyActionBusy = false;
      this.changeDetector.markForCheck();
    })).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (room) => {
        this.room = room;
        this.actionMessage = '遊戲已開始，正在載入第一回合。';
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.actionError = this.game.errorMessage(error);
        this.changeDetector.markForCheck();
      }
    });
  }

  requestLeaveRoom(): void {
    if (!this.room || this.leaving) return;
    this.leaveDialogTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.showLeaveConfirm = true;
    setTimeout(() => this.leaveDialog?.nativeElement.querySelector<HTMLElement>('button:not([disabled])')?.focus(), 0);
  }

  cancelLeaveRoom(): void {
    this.showLeaveConfirm = false;
    this.restoreLeaveDialogTrigger();
  }

  leaveRoom(): void {
    if (!this.room || this.leaving) return;
    this.showLeaveConfirm = false;
    if (this.testMode) {
      this.leaving = true;
      this.changeDetector.markForCheck();
      void this.router.navigate(['/game/test'], { queryParams: { scenario: this.room?.id } });
      return;
    }
    this.actionError = '';
    this.leaving = true;
    this.game.leaveRoom(this.room.id).pipe(finalize(() => {
      this.leaving = false;
      this.changeDetector.markForCheck();
    })).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => void this.router.navigate(['/game']),
      error: (error: unknown) => {
        this.actionError = this.game.errorMessage(error);
        this.restoreLeaveDialogTrigger();
        this.changeDetector.markForCheck();
      }
    });
  }

  private restoreLeaveDialogTrigger(): void {
    const trigger = this.leaveDialogTrigger;
    this.leaveDialogTrigger = null;
    setTimeout(() => trigger?.focus(), 0);
  }

  @HostListener('document:keydown.escape')
  closeLeaveConfirmation(): void {
    if (this.showLeaveConfirm) {
      this.cancelLeaveRoom();
      return;
    }
    if (this.testToolsOpen) this.testToolsOpen = false;
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
      && !this.round.answers.some(item => item.answerType === answer.answerType && this.votedAnswerIds.has(item.id));
  }

  readonly canVoteAtTable = (answer: GameAnswer): boolean => this.canVoteFor(answer);

  submitAnswer(): void {
    if (!this.currentPlayerId || !this.round || !this.game.canAnswer(this.round, this.now) || this.hasSubmittedAnswer()) return;
    if (this.testMode) {
      this.submitTestAnswer();
      return;
    }
    this.actionError = '';
    this.actionMessage = '';
    this.submittingAnswer = true;
    const submittedRoundId = this.round.id;
    this.game.submitAnswer(submittedRoundId, { answerType: this.answerType, text: this.answerText })
      .pipe(finalize(() => {
        this.submittingAnswer = false;
        this.changeDetector.markForCheck();
      }))
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (answer) => {
          this.currentPlayerId = answer.gamePlayerId;
          this.submittedRoundId = submittedRoundId;
          this.clearDraft(submittedRoundId);
          if (this.round?.id === submittedRoundId) {
            this.answerText = '';
            this.actionMessage = '回答已送出，等待其他玩家完成作答。';
          }
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
    if (this.testMode) {
      this.submitTestVote(answer);
      return;
    }
    this.actionError = '';
    this.actionMessage = '';
    this.votingForAnswerId = answer.id;
    this.game.submitVote(this.round.id, { answerId: answer.id, count: 1 })
      .pipe(finalize(() => {
        this.votingForAnswerId = '';
        this.changeDetector.markForCheck();
      }))
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.votedAnswerIds = new Set([...this.votedAnswerIds, answer.id]);
          this.actionMessage = '投好了！揭曉時就能看到作者和票數。';
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
    if (this.testMode) {
      this.reward = {
        pointReward: 18,
        normalKeyReward: 1,
        performanceScore: 86,
        roundsWon: this.testRounds.filter((round) => round.winnerPlayerDisplayName === '你').length,
        alreadyRewarded: false,
        keyProgressReward: 0,
        keyRewardDivisor: 1
      };
      this.actionMessage = '測試獎勵已顯示；這筆結果只存在目前頁面。';
      this.changeDetector.markForCheck();
      return;
    }
    this.actionError = '';
    this.actionMessage = '';
    this.rewarding = true;
    this.game.rewardMainGame(this.room.id)
      .pipe(finalize(() => {
        this.rewarding = false;
        this.changeDetector.markForCheck();
      }))
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (reward) => {
          this.reward = reward;
          this.actionMessage = reward.alreadyRewarded
            ? '這間房的獎勵已領取。'
            : '多人鑑定獎勵已入帳。';
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          this.actionError = this.game.errorMessage(error);
          this.changeDetector.markForCheck();
      }
    });
  }

  private initializeTestFlow(): void {
    this.loading = true;
    this.room = null;
    this.round = null;
    this.history = null;
    this.refreshError = '';
    this.testScenario = null;
    this.testAutoPaused = true;
    const loadRooms: Observable<unknown> = this.roomId.startsWith('test-room-virtual-') && !this.game.getRehearsalRoom(this.roomId)
      ? this.game.getRehearsalRooms({ pageSize: 100 }) : of(null);
    loadRooms.pipe(switchMap(() => {
      this.testRoomOptions = this.game.getRehearsalRoom(this.roomId);
      return this.game.getRehearsalSession(this.testScenarioFor(this.roomId).totalRounds,
        this.testRoomOptions ? this.testRoomOptions.maxPlayers : 4);
    }), takeUntilDestroyed(this.destroyRef)).subscribe({
        next: session => {
          this.testMaterials = session.materials;
          this.testPlayerNames = session.playerNames;
          this.testCurrentPlayerName = session.currentPlayerName;
          this.buildTestFlow();
          this.changeDetector.markForCheck();
        },
        error: error => {
          this.loading = false;
          this.refreshError = this.game.errorMessage(error);
          this.changeDetector.markForCheck();
        }
      });
  }

  private buildTestFlow(): void {
    const scenario = this.testScenarioFor(this.roomId);
    const createdAt = new Date(Date.now() - 60_000).toISOString();
    this.testScenario = scenario;
    this.testStage = 'WAITING';
    this.testStageEndsAt = Date.now() + scenario.waitingSeconds * 1000;
    this.testAutoPaused = false;
    this.testToolsOpen = false;
    this.testRounds = [];
    this.testSubmittedAnswer = null;
    this.testPausedRemainingMs = 0;
    this.loading = false;
    this.refreshing = false;
    this.refreshError = '';
    this.roundLoadError = '';
    this.actionError = '';
    this.actionMessage = '';
    this.answerText = '';
    this.submittedRoundId = '';
    this.lastRoundId = '';
    this.votedAnswerIds = new Set<string>();
    this.reward = null;
    this.rewarding = false;
    this.leaving = false;
    this.showLeaveConfirm = false;
    this.currentPlayerId = this.testSelfId;
    this.room = {
      id: this.roomId,
      roomCode: scenario.roomCode,
      status: 'WAITING',
      visibility: 'PUBLIC',
      maxPlayers: this.testRoomOptions?.maxPlayers ?? 4,
      totalRounds: scenario.totalRounds,
      answerSeconds: scenario.answerSeconds,
      votingSeconds: scenario.votingSeconds,
      categoryFilterCode: null,
      eraBucketFilterCode: null,
      currentRoundNo: 0,
      currentRoundId: null,
      currentPlayerId: this.testSelfId,
      playerCount: this.testPlayerNames.length + 1,
      players: [
        { id: this.testSelfId, displayName: this.testCurrentPlayerName, role: 'HOST', isReady: true, seatNo: 1, connectionStatus: 'ONLINE' },
        ...this.testPlayerNames.map((displayName, index) => ({ id: `test-player-${index}`, displayName, role: 'PLAYER', isReady: true, seatNo: index + 2, connectionStatus: 'ONLINE' }))
      ],
      createdAt,
      startedAt: null,
      endedAt: null
    };
    this.history = null;
    this.round = null;
    this.chatMessages = [];
    this.playerColors = Object.fromEntries(this.room.players.map((player, index) => [player.id, this.cardColors[index % this.cardColors.length]]));
    this.changeDetector.markForCheck();
  }

  private testScenarioFor(roomId: string): TestScenario {
    if (this.testRoomOptions) {
      return { roomCode: this.testRoomOptions.roomCode, totalRounds: this.testRoomOptions.totalRounds, waitingSeconds: 4, answerSeconds: 90, votingSeconds: 30, revealSeconds: 6 };
    }
    if (roomId === 'test-room-standard') {
      return { roomCode: 'A103', totalRounds: 3, waitingSeconds: 5, answerSeconds: 90, votingSeconds: 30, revealSeconds: 6 };
    }
    if (roomId === 'test-room-replay') {
      return { roomCode: 'A102', totalRounds: 2, waitingSeconds: 4, answerSeconds: 45, votingSeconds: 20, revealSeconds: 5 };
    }
    return { roomCode: 'A101', totalRounds: 2, waitingSeconds: 3, answerSeconds: 12, votingSeconds: 10, revealSeconds: 4 };
  }

  private advanceTestFlow(force = false): void {
    if (!this.testMode || !this.testScenario || !this.room || this.testStage === 'COMPLETED') return;
    if (!this.testAutoPaused && this.testStage === 'ANSWERING') this.collectTestBotAnswers();
    if (!force && (this.testAutoPaused || Date.now() < this.testStageEndsAt)) return;

    switch (this.testStage) {
      case 'WAITING':
        this.startTestRound(1);
        return;
      case 'ANSWERING':
        this.startTestVoting();
        return;
      case 'VOTING':
        this.startTestReveal();
        return;
      case 'REVEALED':
        if (this.room.currentRoundNo < this.testScenario.totalRounds) {
          this.startTestRound(this.room.currentRoundNo + 1);
        } else {
          this.completeTestRoom();
        }
        return;
    }
  }

  private startTestRound(roundNumber: number): void {
    if (!this.room || !this.testScenario) return;
    const now = Date.now();
    const startedAt = new Date(now).toISOString();
    const roundId = `${this.roomId}-round-${roundNumber}`;
    const answerDeadlineAt = new Date(now + this.testScenario.answerSeconds * 1000).toISOString();
    const votingDeadlineAt = new Date(now + (this.testScenario.answerSeconds + this.testScenario.votingSeconds) * 1000).toISOString();
    // 圖片、文物名稱與三類回答都來自同一件歷史回合的文物。
    const artifact = this.testMaterials[roundNumber - 1];
    if (!artifact) return;
    // 三種類型各保留一份歷史回答，讓演練可以完成每種類型的投票。
    const historicalAnswers = [...artifact.answers].sort(() => Math.random() - 0.5);
    this.testBotPlans = this.testPlayerNames.map((name, index) => ({
      answer: this.makeTestAnswer(`${roundId}-answer-${index}`, `test-player-${index}`, name,
        (historicalAnswers[index] ?? artifact.answers[index % artifact.answers.length]).answerType,
        historicalAnswers[index]?.text ?? `這是「${name}」的模擬回答，僅供展示。`),
      readyAt: now + Math.round((0.2 + 0.65 * (index + Math.random()) / this.testPlayerNames.length) * this.testScenario!.answerSeconds * 1000),
      submitted: false
    }));

    this.room = {
      ...this.room,
      status: 'PLAYING',
      currentRoundNo: roundNumber,
      currentRoundId: roundId,
      currentPlayerId: this.testSelfId,
      startedAt: this.room.startedAt ?? startedAt,
      endedAt: null
    };
    this.round = {
      id: roundId,
      roomId: this.roomId,
      currentPlayerId: this.testSelfId,
      votedAnswerIds: [],
      artifactId: artifact.artifactId,
      artifactName: artifact.artifactName,
      primaryImagePath: artifact.primaryImagePath,
      thumbnailPath: artifact.thumbnailPath,
      roundNumber,
      status: 'ANSWERING',
      isSettled: false,
      startedAt,
      answerDeadlineAt,
      votingDeadlineAt,
      settledAt: null,
      participantCount: this.room.players.length,
      totalVoteCount: 0,
      winnerAnswerId: null,
      winnerPlayerDisplayName: null,
      answers: []
    };
    this.testStage = 'ANSWERING';
    this.testStageEndsAt = now + this.testScenario.answerSeconds * 1000;
    this.testPausedRemainingMs = 0;
    this.now = now;
    this.testSubmittedAnswer = null;
    this.submittedRoundId = '';
    this.votedAnswerIds = new Set<string>();
    this.answerText = '';
    this.actionError = '';
    this.actionMessage = `第 ${roundNumber} 回合開始，請先觀察館藏並寫下判斷。`;
    this.artifactImageUnavailable = false;
  }

  private startTestVoting(): void {
    if (!this.round || !this.testScenario) return;
    const now = Date.now();
    const material = this.testMaterials[this.round.roundNumber - 1];
    if (!material) return;
    this.collectTestBotAnswers(true);
    const answers: GameAnswer[] = [
      ...(this.testSubmittedAnswer ? [{ ...this.testSubmittedAnswer, voteCount: 0, rank: 0, isWinner: false }] : []),
      ...this.testBotPlans.map(plan => ({ ...plan.answer }))
    ];
    // 每位模擬玩家只投給別人，唯一回答的場次可沒有有效得票。
    for (const plan of this.testBotPlans) {
      for (const type of this.answerTypes) {
        const targets = answers.filter(answer => answer.gamePlayerId !== plan.answer.gamePlayerId && answer.answerType === type.value);
        if (targets.length) targets[Math.floor(Math.random() * targets.length)].voteCount += 1;
      }
    }
    this.round = {
      ...this.round,
      status: 'VOTING',
      votingDeadlineAt: new Date(now + this.testScenario.votingSeconds * 1000).toISOString(),
      answers,
      totalVoteCount: answers.reduce((total, answer) => total + answer.voteCount, 0)
    };
    this.testStage = 'VOTING';
    this.testStageEndsAt = now + this.testScenario.votingSeconds * 1000;
    this.testPausedRemainingMs = 0;
    this.now = now;
    this.actionMessage = '回答已整理完成，現在可以投票選出最有說服力的說法。';
    this.answerText = '';
  }

  private startTestReveal(): void {
    if (!this.round || !this.testScenario) return;
    const now = Date.now();
    const settledAt = new Date(now).toISOString();
    const rankedAnswers = [...this.round.answers]
      .sort((left, right) => right.voteCount - left.voteCount || left.submittedAt.localeCompare(right.submittedAt) || left.id.localeCompare(right.id))
      .map((answer, index): GameAnswer => ({
        ...answer,
        rank: index + 1,
        isWinner: index === 0 && answer.voteCount > 0
      }));
    const winner = rankedAnswers.find((answer) => answer.isWinner) ?? null;
    const revealedRound: GameRoundDetails = {
      ...this.round,
      status: 'REVEALED',
      isSettled: true,
      settledAt,
      answers: rankedAnswers,
      totalVoteCount: rankedAnswers.reduce((total, answer) => total + answer.voteCount, 0),
      winnerAnswerId: winner?.id ?? null,
      winnerPlayerDisplayName: winner?.playerDisplayName ?? null
    };
    this.round = revealedRound;
    this.testRounds = [
      ...this.testRounds,
      { ...revealedRound, answers: revealedRound.answers.map((answer) => ({ ...answer })) }
    ];
    this.testStage = 'REVEALED';
    this.testStageEndsAt = now + this.testScenario.revealSeconds * 1000;
    this.testPausedRemainingMs = 0;
    this.now = now;
    this.actionMessage = winner
      ? `本回合由「${winner.playerDisplayName}」勝出，稍後自動進入下一回合。`
      : '本回合沒有有效得票，稍後自動進入下一回合。';
  }

  private collectTestBotAnswers(force = false): void {
    const now = Date.now();
    for (const plan of this.testBotPlans) {
      if (!plan.submitted && (force || now >= plan.readyAt)) {
        plan.submitted = true;
        plan.answer = { ...plan.answer, submittedAt: new Date(Math.min(now, plan.readyAt)).toISOString() };
      }
    }
    if (this.round?.status === 'ANSWERING') {
      this.round = { ...this.round, submittedAnswerCount: this.testBotPlans.filter(plan => plan.submitted).length + (this.testSubmittedAnswer ? 1 : 0) };
    }
  }

  private completeTestRoom(): void {
    if (!this.room || !this.testScenario) return;
    const rounds: GameRoundSummary[] = this.testRounds.map((round) => ({
      id: round.id,
      roundNumber: round.roundNumber,
      artifactId: round.artifactId,
      artifactName: round.artifactName,
      status: 'REVEALED',
      isSettled: true,
      startedAt: round.startedAt,
      settledAt: round.settledAt,
      answerCount: round.answers.length,
      totalVoteCount: round.totalVoteCount,
      winnerAnswerId: round.winnerAnswerId,
      winnerPlayerDisplayName: round.winnerPlayerDisplayName,
      answers: round.answers.map((answer) => ({ ...answer }))
    }));
    const playerNames = this.room.players.map(player => ({ id: player.id, name: player.displayName }));
    const totals = new Map(playerNames.map((player) => [player.id, { score: 0, wins: 0 }]));
    for (const round of rounds) {
      for (const answer of round.answers) {
        const total = totals.get(answer.gamePlayerId);
        if (total) total.score += answer.voteCount;
      }
      const winner = round.answers.find((answer) => answer.isWinner);
      if (winner) {
        const total = totals.get(winner.gamePlayerId);
        if (total) total.wins += 1;
      }
    }
    const leaderboard = playerNames
      .map((player) => ({
        gamePlayerId: player.id,
        displayName: player.name,
        score: totals.get(player.id)?.score ?? 0,
        roundsAnswered: rounds.filter(round => round.answers.some(answer => answer.gamePlayerId === player.id)).length,
        roundsWon: totals.get(player.id)?.wins ?? 0,
        rank: 0
      }))
      .sort((left, right) => right.score - left.score || right.roundsWon - left.roundsWon || right.roundsAnswered - left.roundsAnswered || left.displayName.localeCompare(right.displayName))
      .map((player, index) => ({ ...player, rank: index + 1 }));

    const endedAt = new Date().toISOString();
    this.room = {
      ...this.room,
      status: 'COMPLETED',
      currentRoundNo: this.testScenario.totalRounds,
      currentRoundId: null,
      endedAt
    };
    this.history = {
      roomId: this.roomId,
      roomCode: this.room.roomCode,
      status: 'COMPLETED',
      rounds,
      leaderboard
    };
    this.round = null;
    this.testStage = 'COMPLETED';
    this.testAutoPaused = true;
    this.testPausedRemainingMs = 0;
    this.testStageEndsAt = 0;
    this.actionMessage = '演練已完成，可以查看結算或返回流程演練；本局不會發放正式獎勵。';
  }

  private submitTestAnswer(): void {
    if (!this.round || !this.answerText.trim()) return;
    const answer = this.makeTestAnswer(
      `${this.round.id}-answer-self`,
      this.testSelfId,
      this.testCurrentPlayerName,
      this.answerType,
      this.answerText.trim()
    );
    this.testSubmittedAnswer = answer;
    this.submittedRoundId = this.round.id;
    this.answerText = '';
    this.actionMessage = '回答已保留在本機測試流程，稍後會進入投票。';
    this.changeDetector.markForCheck();
  }

  private submitTestVote(answer: GameAnswer): void {
    if (!this.round || !this.canVoteFor(answer)) return;
    this.round = { ...this.round, answers: this.round.answers.map(item => item.id === answer.id ? { ...item, voteCount: item.voteCount + 1 } : item) };
    this.votedAnswerIds = new Set([...this.votedAnswerIds, answer.id]);
    this.actionMessage = '投好了！揭曉時就能看到作者和票數。';
    this.changeDetector.markForCheck();
  }

  private makeTestAnswer(
    id: string,
    gamePlayerId: string,
    playerDisplayName: string,
    answerType: GameAnswerType,
    text: string,
    voteCount = 0
  ): GameAnswer {
    return {
      id,
      gamePlayerId,
      playerDisplayName,
      answerType,
      text,
      voteCount,
      rank: 0,
      isWinner: false,
      submittedAt: new Date().toISOString()
    };
  }

  private updateTestRoundDeadlines(startAt: number): void {
    if (!this.round || !this.testScenario) return;
    if (this.round.status === 'ANSWERING') {
      this.round = {
        ...this.round,
        answerDeadlineAt: new Date(startAt + this.testPausedRemainingMs).toISOString(),
        votingDeadlineAt: new Date(startAt + this.testPausedRemainingMs + this.testScenario.votingSeconds * 1000).toISOString()
      };
      return;
    }
    if (this.round.status === 'VOTING') {
      this.round = {
        ...this.round,
        votingDeadlineAt: new Date(startAt + this.testPausedRemainingMs).toISOString()
      };
    }
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
      switchMap(snapshot => !snapshot.room.currentPlayerId || snapshot.room.status === 'CANCELLED'
        ? of(snapshot)
        : this.game.getRoomPresentation(this.roomId, this.connectionId).pipe(
          map(presentation => ({ ...snapshot, presentation })),
          catchError(error => { this.chatError = this.game.errorMessage(error); return of(snapshot); })
        )),
      catchError((error: unknown) => {
        this.refreshError = this.game.errorMessage(error);
        this.needsGameAccount = error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403);
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
