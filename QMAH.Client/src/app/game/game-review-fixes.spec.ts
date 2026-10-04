import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { afterEach, describe, expect, it } from 'vitest';
import { GameDetailLocatorBoardComponent } from './game-detail-locator-board.component';
import { GameAnswerTableComponent } from './game-answer-table.component';
import { GameAnswer, GameRoundDetails } from './game.models';

const scrollToDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo');
afterEach(() => {
  TestBed.resetTestingModule();
  if (scrollToDescriptor) Object.defineProperty(HTMLElement.prototype, 'scrollTo', scrollToDescriptor);
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo');
});

describe('審查問題回歸', () => {
  it('上一件文物的評語不會顯示在下一件原圖上', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    const fixture = TestBed.createComponent(GameDetailLocatorBoardComponent);
    fixture.componentRef.setInput('artifacts', [
      { artifactId: 'first', name: '第一件', primaryImagePath: '/first.jpg', thumbnailPath: null },
      { artifactId: 'second', name: '第二件', primaryImagePath: '/second.jpg', thumbnailPath: null }
    ]);
    fixture.componentRef.setInput('seed', 'test');
    fixture.detectChanges();
    fixture.componentInstance.verdict.set({ artifactId: 'first', text: '命中', tier: 'nice', x: .5, y: .5 });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.locator-verdict')).not.toBeNull();
    fixture.componentRef.setInput('answers', [{ artifactId: 'first', x: .5, y: .5, imageWidth: 500, imageHeight: 500 }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.locator-verdict')).toBeNull();
    expect(fixture.componentInstance.current().artifactId).toBe('second');
  });

  it('投票確認聚焦再想想，取消後回到投票按鈕', async () => {
    // jsdom 未提供捲動 API；此案例只驗證確認步驟的焦點。
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: () => undefined });
    const answer: GameAnswer = { id: 'answer', gamePlayerId: 'other', playerDisplayName: '玩家', answerType: 'FACTUAL_REASONING', text: '回答', voteCount: 0, rank: 0, isWinner: false, submittedAt: '' };
    const round: GameRoundDetails = { id: 'round', roomId: 'room', currentPlayerId: 'self', votedAnswerIds: [], artifactId: 'artifact', artifactName: '文物', primaryImagePath: null, thumbnailPath: null, roundNumber: 1, status: 'VOTING', isSettled: false, startedAt: '', answerDeadlineAt: '', votingDeadlineAt: '', settledAt: null, participantCount: 2, totalVoteCount: 0, winnerAnswerId: null, winnerPlayerDisplayName: null, answers: [answer] };
    const fixture = TestBed.createComponent(GameAnswerTableComponent);
    fixture.componentRef.setInput('players', []);
    fixture.componentRef.setInput('round', round);
    fixture.componentRef.setInput('currentPlayerId', 'self');
    fixture.componentRef.setInput('votedAnswerIds', new Set<string>());
    fixture.componentRef.setInput('votingForAnswerId', '');
    fixture.componentRef.setInput('canVote', () => true);
    fixture.detectChanges();
    document.body.appendChild(fixture.nativeElement);
    const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
    dialog.showModal = () => dialog.setAttribute('open', '');
    fixture.componentInstance.openAnswer(answer);
    fixture.detectChanges();
    fixture.componentInstance.setVoteConfirmation(answer.id);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement?.textContent?.trim()).toBe('再想想');
    fixture.componentInstance.setVoteConfirmation('');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement?.textContent?.trim()).toBe('投給這張回答');
    fixture.nativeElement.remove();
  });
});
