import { signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameRoomComponent } from './game-room.component';
import { watchRoomRefresh } from './game-room-refresh';
import { HttpErrorResponse } from '@angular/common/http';

afterEach(() => vi.useRealTimers());

describe('牌桌刷新', () => {
  it('大量通知合併為一次補讀，離開頁面時才取消正在讀取的請求', () => {
    const triggers = new Subject<void>();
    const responses = [new Subject<number>(), new Subject<number>()];
    const values: number[] = [];
    const load = vi.fn(() => responses[load.mock.calls.length - 1]);
    const subscription = watchRoomRefresh(triggers, load).subscribe(value => values.push(value));
    triggers.next();
    for (let i = 0; i < 100; i++) triggers.next();
    expect(load).toHaveBeenCalledTimes(1);
    responses[0].next(1); responses[0].complete();
    expect(load).toHaveBeenCalledTimes(2);
    responses[1].next(2);
    subscription.unsubscribe();
    triggers.next(); responses[1].next(3);
    expect(load).toHaveBeenCalledTimes(2);
    expect(values).toEqual([1, 2]);
    expect(responses[1].observed).toBe(false);
  });
  it('連線通知重疊時不取消初次載入，完成後補讀最新房間', async () => {
    vi.useFakeTimers();
    const changes = new Subject<void>();
    const response = new Subject<any>();
    let cancelled = 0;
    let finished = false;
    const context: any = {
      gameFocus: { active: signal(false) },
      route: { snapshot: { paramMap: { get: () => 'room' }, queryParamMap: { get: () => null } } },
      live: { watch: () => changes },
      currentPlayerId: '', lastRoundId: '',
      changeDetector: { markForCheck: vi.fn() },
      restoreDraft: vi.fn(), restoreVotedAnswers: vi.fn(),
      loadSnapshot: vi.fn(() => new Observable(subscriber => {
        const sub = response.subscribe(subscriber);
        return () => { if (!finished) cancelled++; sub.unsubscribe(); };
      })),
    };
    try {
      GameRoomComponent.prototype.ngOnInit.call(context);
      await vi.advanceTimersByTimeAsync(1);
      changes.next();
      await vi.advanceTimersByTimeAsync(60);
      expect(cancelled).toBe(0);
      expect(context.loadSnapshot).toHaveBeenCalledTimes(1);
      finished = true;
      response.next({ room: { currentPlayerId: null }, history: null, round: null });
      response.complete();
      expect(context.loadSnapshot).toHaveBeenCalledTimes(2);
    } finally {
      context.pollSubscription?.unsubscribe();
      context.clockSubscription?.unsubscribe();
      context.heartbeatSubscription?.unsubscribe();
    }
  });
});

describe('單人等待房關閉', () => {
  function setup(status = 'WAITING', role = 'HOST', count = 1) {
    const context: any = {
      testMode: false, isSpectator: false,
      room: { id: 'room', status, players: Array.from({ length: count }, () => ({ connectionStatus: 'ONLINE' })) },
      currentPlayer: () => ({ role }),
      leaveRoom: vi.fn(),
      game: { closeSoloRoom: vi.fn(() => new Subject<void>()), errorMessage: () => '連線失敗' },
      destroyRef: { destroyed: false, onDestroy: () => () => {} },
      changeDetector: { markForCheck: vi.fn() },
      router: { navigate: vi.fn() },
    };
    context.canCloseSoloRoom = () => GameRoomComponent.prototype.canCloseSoloRoom.call(context);
    return context;
  }

  it('只有房主的等待房可以直接關閉，不需先開啟離開確認', () => {
    const context = setup();
    GameRoomComponent.prototype.closeSoloRoom.call(context);
    expect(context.game.closeSoloRoom).toHaveBeenCalledOnce();
    expect(context.leaveRoom).not.toHaveBeenCalled();
    GameRoomComponent.prototype.closeSoloRoom.call(context);
    expect(context.game.closeSoloRoom).toHaveBeenCalledOnce();
  });

  it.each([['WAITING', 'HOST', 2], ['WAITING', 'PLAYER', 1], ['PLAYING', 'HOST', 1]])(
    '多人、非房主或進行中的房間不可直接關閉：%s %s %s', (status, role, count) => {
      const context = setup(status, role, count);
      GameRoomComponent.prototype.closeSoloRoom.call(context);
      expect(context.leaveRoom).not.toHaveBeenCalled();
      expect(context.game.closeSoloRoom).not.toHaveBeenCalled();
    });

  it('有人剛加入時留在房間並提示衝突，不默默改成離開', () => {
    const context = setup();
    const response = new Subject<void>();
    context.game.closeSoloRoom.mockReturnValue(response);
    GameRoomComponent.prototype.closeSoloRoom.call(context);
    response.error(new HttpErrorResponse({ status: 409 }));
    expect(context.router.navigate).not.toHaveBeenCalled();
    expect(context.leaveRoom).not.toHaveBeenCalled();
    expect(context.leaving).toBe(false);
    expect(context.actionError).toContain('其他玩家');
  });
});
