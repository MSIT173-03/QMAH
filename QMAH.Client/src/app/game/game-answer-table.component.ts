import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, input, output, signal, viewChild } from '@angular/core';

import { GameAnswer, GameAnswerType, GamePlayer, GameRoundDetails } from './game.models';
import { GameAnswerCardComponent } from './game-answer-card.component';
import { QmahIconName } from '../shared/components/qmah-icon/qmah-icon';

const ANSWER_GROUPS: readonly { type: GameAnswerType; label: string; icon: QmahIconName }[] = [
  { type: 'FACTUAL_REASONING', label: '史實推理', icon: 'book-open' },
  { type: 'PLAUSIBLE_FICTION', label: '擬真異說', icon: 'eye' },
  { type: 'CREATIVE_TALE', label: '妙想奇談', icon: 'sparkles' }
];
const PLAYER_BACK_COLORS: Readonly<Record<string, string>> = {
  jade: '#376d62',
  blue: '#567caa',
  vermilion: '#b84f42',
  gold: '#a98336',
  violet: '#74639d',
  teal: '#27827f',
  rose: '#b76074',
  slate: '#657887',
  olive: '#72834a',
  copper: '#a8663e',
  indigo: '#4c5ca4',
  sand: '#c39c63'
};
const PLAYER_COLOR_CODES = Object.keys(PLAYER_BACK_COLORS);

@Component({
  selector: 'app-game-answer-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GameAnswerCardComponent],
  templateUrl: './game-answer-table.component.html',
  styleUrl: './game-answer-table.component.scss'
})
export class GameAnswerTableComponent {
  readonly players = input.required<GamePlayer[]>();
  readonly round = input.required<GameRoundDetails>();
  readonly currentPlayerId = input.required<string>();
  readonly playerColors = input<Record<string, string>>({});
  readonly showSeats = input(true);
  readonly showHeader = input(true);
  readonly compact = input(true);
  readonly votedAnswerIds = input.required<ReadonlySet<string>>();
  readonly votingForAnswerId = input.required<string>();
  readonly canVote = input.required<(answer: GameAnswer) => boolean>();
  readonly vote = output<GameAnswer>();

  readonly selectedAnswerId = signal<string | null>(null);
  readonly selectedAnswer = computed(() => this.round().answers.find(answer => answer.id === this.selectedAnswerId()) ?? null);
  private readonly answerDialog = viewChild<ElementRef<HTMLDialogElement>>('answerDialog');
  private readonly mobileAnswerCarousel = viewChild<ElementRef<HTMLElement>>('mobileAnswerCarousel');
  private readonly roundId = computed(() => this.round().id);
  readonly selectedMobileAnswerType = signal<GameAnswerType>('FACTUAL_REASONING');
  readonly carouselIndex = signal(0);
  readonly answerGroups = computed(() => ANSWER_GROUPS
    .map(group => ({
      ...group,
      answers: this.round().answers.filter(answer => answer.answerType === group.type)
    }))
    .filter(group => group.answers.length > 0));
  readonly answerTypeChoices = computed(() => ANSWER_GROUPS.map(group => ({
    ...group,
    count: this.round().answers.filter(answer => answer.answerType === group.type).length,
    voted: this.round().status === 'VOTING'
      && this.round().answers.some(answer => answer.answerType === group.type && this.votedAnswerIds().has(answer.id))
  })));
  readonly activeMobileAnswerType = computed(() => {
    const groups = this.answerGroups();
    const selected = this.selectedMobileAnswerType();
    return groups.some(group => group.type === selected) ? selected : groups[0]?.type ?? selected;
  });
  readonly answerSlides = computed(() => this.answerGroups().flatMap(group =>
    group.type === this.activeMobileAnswerType()
      ? group.answers.map((answer, index) => ({ group, answer, index, count: group.answers.length }))
      : []));
  readonly answerBacks = computed(() => Array.from(
    { length: Math.min(this.submittedAnswerCount(), 8) },
    (_, index) => index
  ));

  constructor() {
    effect(() => {
      if (this.selectedAnswerId() && !this.selectedAnswer()) this.closeAnswer();
    });
    effect(() => {
      this.roundId();
      const rail = this.mobileAnswerCarousel()?.nativeElement;
      if (rail) {
        this.carouselIndex.set(0);
        rail.scrollTo({ left:0, behavior:'auto' });
      }
    });
  }

  submittedAnswerCount(): number {
    const count = (this.round() as GameRoundDetails & { submittedAnswerCount?: number }).submittedAnswerCount ?? 0;
    return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  }

  answerTypeText(type: GameAnswerType): string {
    return ANSWER_GROUPS.find(group => group.type === type)?.label ?? '回答';
  }

  selectMobileAnswerType(type: GameAnswerType): void {
    this.selectedMobileAnswerType.set(type);
    this.carouselIndex.set(0);
    this.mobileAnswerCarousel()?.nativeElement.scrollTo({ left: 0, behavior: 'auto' });
  }

  updateCarouselIndex(): void {
    const rail = this.mobileAnswerCarousel()?.nativeElement;
    const cards = rail?.querySelectorAll<HTMLElement>('app-game-answer-card');
    if (!rail || !cards?.length) return;
    const firstOffset = cards[0].offsetLeft;
    let nearest = 0;
    for (let index = 1; index < cards.length; index++) {
      if (Math.abs(cards[index].offsetLeft - firstOffset - rail.scrollLeft)
        < Math.abs(cards[nearest].offsetLeft - firstOffset - rail.scrollLeft)) nearest = index;
    }
    this.carouselIndex.set(nearest);
  }

  browseAnswers(direction: -1 | 1): void {
    const rail = this.mobileAnswerCarousel()?.nativeElement;
    const cards = rail?.querySelectorAll<HTMLElement>('app-game-answer-card');
    if (!rail || !cards?.length) return;
    const index = Math.max(0, Math.min(cards.length - 1, this.carouselIndex() + direction));
    rail.scrollTo({ left: cards[index].offsetLeft - cards[0].offsetLeft,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  seatColor(playerId: string, index: number): string {
    const selectedCode = this.playerColors()[playerId] ?? PLAYER_COLOR_CODES[index % PLAYER_COLOR_CODES.length];
    return PLAYER_BACK_COLORS[selectedCode] ?? PLAYER_BACK_COLORS[PLAYER_COLOR_CODES[index % PLAYER_COLOR_CODES.length]];
  }

  openAnswer(answer: GameAnswer): void {
    this.selectedAnswerId.set(answer.id);
    const dialog = this.answerDialog()?.nativeElement;
    if (dialog && !dialog.open) dialog.showModal();
  }

  closeAnswer(): void {
    const dialog = this.answerDialog()?.nativeElement;
    if (dialog?.open) dialog.close();
    this.selectedAnswerId.set(null);
  }

  closeOnBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeAnswer();
  }

  canSubmitVote(answer: GameAnswer): boolean {
    return this.canVote()(answer)
      && !this.votedAnswerIds().has(answer.id)
      && !this.votingForAnswerId();
  }

  submitVote(answer: GameAnswer): void {
    if (!this.canSubmitVote(answer)) return;
    this.vote.emit(answer);
  }

  voteButtonText(answer: GameAnswer): string {
    if (this.votingForAnswerId()) return '投票送出中…';
    if (this.votedAnswerIds().has(answer.id)) return '這張已投票';
    return this.canVote()(answer) ? '投給這張回答' : '目前不能投這張';
  }

}
