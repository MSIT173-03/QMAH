import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
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

  it('requires two to five minutes for answering and voting', () => {
    const defaults = service.roomDefaults();
    expect(service.validateCreateRoomRequest({ ...defaults, answerSeconds: 119, votingSeconds: 119 })).toHaveLength(2);
    expect(service.validateCreateRoomRequest({ ...defaults, answerSeconds: 120, votingSeconds: 300 })).toEqual([]);
    expect(service.validateCreateRoomRequest({ ...defaults, answerSeconds: 301, votingSeconds: 301 })).toHaveLength(2);
  });

  it('creates a simulated room locally and retains its timers without a formal room request', () => {
    const http = TestBed.inject(HttpTestingController);
    service.createRehearsalRoom({ ...service.roomDefaults(), answerSeconds: 240, votingSeconds: 300 }).subscribe(room => {
      expect(room.id.startsWith('test-room-local-')).toBe(true);
      expect(service.getRehearsalRoom(room.id)).toEqual(room);
      expect(service.getRehearsalTiming(room.id)).toEqual({ answerSeconds: 240, votingSeconds: 300 });
    });
    http.expectNone(request => request.method === 'POST');
    http.verify();
  });

  it('preserves simulated rooms while filtering and rerolls only on refresh', () => {
    const http = TestBed.inject(HttpTestingController);
    const room = { id: 'test-room-virtual-1', roomCode: '1234', status: 'WAITING', visibility: 'PUBLIC', maxPlayers: 4, totalRounds: 2, playerCount: 2, categoryFilterCode: null, eraBucketFilterCode: null, createdAt: new Date().toISOString(), answerSeconds: 180, votingSeconds: 120 };
    service.getRehearsalRooms().subscribe();
    http.expectOne(request => request.url.endsWith('/rehearsal-rooms')).flush({ items: [room], page: 1, pageSize: 100, totalCount: 1, totalPages: 1 });
    service.getRehearsalRooms({ roomCode: ' 12 ' }).subscribe(page => expect(page.items).toEqual([room]));
    http.expectNone(request => request.url.endsWith('/rehearsal-rooms'));
    service.getRehearsalRooms({}, true).subscribe();
    http.expectOne(request => request.url.endsWith('/rehearsal-rooms')).flush({ items: [room], page: 1, pageSize: 100, totalCount: 1, totalPages: 1 });
    http.verify();
  });

  it('normalizes room code search and preserves pagination', () => {
    const http = TestBed.inject(HttpTestingController);
    service.getRooms({ status: 'WAITING', sort: 'RECOMMENDED', page: 2, roomCode: ' a105 ' }).subscribe();
    const request = http.expectOne(item => item.url.endsWith('/game/rooms'));
    expect(request.request.params.get('roomCode')).toBe('A105');
    expect(request.request.params.get('page')).toBe('2');
    request.flush({ items: [], page: 2, pageSize: 20, totalCount: 0, totalPages: 0 });
    http.verify();
  });

  it('sends artifact search and era together with appreciation pagination', () => {
    const http = TestBed.inject(HttpTestingController);
    service.getAppreciation({ artifactId: '', categoryCode: 'CERAMIC', answerType: 'CREATIVE_TALE', sort: 'time', page: 2, keyword: '  四方瓶  ', eraCode: 'QING' }).subscribe();
    const request = http.expectOne(item => item.url.endsWith('/game/appreciation'));
    expect(request.request.params.get('keyword')).toBe('四方瓶');
    expect(request.request.params.get('eraCode')).toBe('QING');
    expect(request.request.params.get('categoryCode')).toBe('CERAMIC');
    expect(request.request.params.get('answerType')).toBe('CREATIVE_TALE');
    expect(request.request.params.get('sort')).toBe('time');
    expect(request.request.params.get('page')).toBe('2');
    request.flush({ items: [], page: 2, pageSize: 12, totalCount: 0, totalPages: 0 });
    http.verify();
  });

  it('omits cleared search filters while preserving a selected artifact', () => {
    const http = TestBed.inject(HttpTestingController);
    service.getAppreciation({ artifactId: 'artifact-id', categoryCode: '', answerType: '', sort: 'votes', page: 1, keyword: '  ', eraCode: '' }).subscribe();
    const request = http.expectOne(item => item.url.endsWith('/game/appreciation'));
    expect(request.request.params.get('artifactId')).toBe('artifact-id');
    expect(request.request.params.has('keyword')).toBe(false);
    expect(request.request.params.has('eraCode')).toBe(false);
    request.flush({ items: [], page: 1, pageSize: 12, totalCount: 0, totalPages: 0 });
    http.verify();
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
