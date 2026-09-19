import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { GameService } from './game.service';

describe('GameService', () => {
  let service: GameService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GameService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(GameService);
  });

  it('should validate room defaults against the game API contract', () => {
    expect(service.validateCreateRoomRequest(service.roomDefaults())).toEqual([]);
  });

  it('should only allow actions while the server deadline is open', () => {
    const now = Date.parse('2026-01-01T00:00:00.000Z');
    const round = {
      status: 'ANSWERING' as const,
      answerDeadlineAt: '2026-01-01T00:00:05.000Z',
      votingDeadlineAt: '2026-01-01T00:00:05.000Z'
    };

    expect(service.canAnswer(round, now)).toBe(true);
    expect(service.canAnswer(round, now + 6_000)).toBe(false);
    expect(service.canVote({ ...round, status: 'VOTING' }, now)).toBe(true);
    expect(service.remainingSeconds(round.answerDeadlineAt, now)).toBe(5);
  });
});
