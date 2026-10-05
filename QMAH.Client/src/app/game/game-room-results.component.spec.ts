import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, vi } from 'vitest';
import { GameRoomResultsComponent } from './game-room-results.component';
import { GameRoomHistory } from './game.models';

describe('多人結算的閱讀順序與獎勵入口', () => {
  beforeEach(() => {
    // jsdom 不提供版面觀察 API，實際尺寸與捲動提示另由瀏覽器驗證。
    vi.stubGlobal('ResizeObserver', class {
      constructor(private readonly notify: ResizeObserverCallback) {}
      observe() { this.notify([], this as unknown as ResizeObserver); }
      disconnect() {}
      unobserve() {}
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  function render(leaderboard: GameRoomHistory['leaderboard']) {
    TestBed.configureTestingModule({ imports: [GameRoomResultsComponent], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(GameRoomResultsComponent);
    fixture.componentRef.setInput('rehearsal', true);
    fixture.componentRef.setInput('history', {
      roomId: 'room', roomCode: 'A101', status: 'COMPLETED', rounds: [], leaderboard
    } satisfies GameRoomHistory);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('沒有排行榜資料時仍可領取獎勵及返回大廳', () => {
    const view = render([]);
    expect(view.querySelector('.empty-copy')?.textContent).toContain('沒有排行榜資料');
    expect(view.querySelector('.reward-panel button')?.textContent).toContain('領取本局獎勵');
    expect(view.querySelector('.results-back-link')?.getAttribute('href')).toBe('/game?test=1');
  });

  it('先呈現排行與回合紀錄，再呈現獎勵操作', () => {
    const view = render([{ gamePlayerId: 'player', displayName: '小青', rank: 1, score: 3, roundsWon: 1, roundsAnswered: 1 }]);
    const sections = Array.from(view.querySelector('.results-sheet')!.children);
    const ranking = view.querySelector('.results-main')!;
    const rewards = view.querySelector('.results-side')!;
    expect(sections.indexOf(ranking)).toBeLessThan(sections.indexOf(rewards));
    expect(ranking.contains(rewards)).toBe(false);
  });
});
