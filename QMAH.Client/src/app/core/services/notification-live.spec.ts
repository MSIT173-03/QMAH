import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { NotificationLive } from './notification-live';
import { MeApiService } from './me-api';

const state = vi.hoisted(() => ({ hubs: [] as any[], buildFailures: 0 }));
vi.mock('@microsoft/signalr', () => ({
  LogLevel: { None: 0 },
  HubConnectionBuilder: class {
    withUrl() { return this; }
    withAutomaticReconnect() { return this; }
    configureLogging() { return this; }
    build() {
      if (state.buildFailures > 0) { state.buildFailures--; throw new Error('Temporary hub initialization failure'); }
      const hub = {
        start: vi.fn(async () => undefined), stop: vi.fn(async () => undefined),
        on: vi.fn(), onreconnected: vi.fn(), onclose: vi.fn()
      };
      state.hubs.push(hub);
      return hub;
    }
  }
}));

describe('NotificationLive', () => {
  const me = signal<any>(null);
  beforeEach(() => {
    state.hubs.length = 0;
    state.buildFailures = 0;
    me.set(null);
    TestBed.configureTestingModule({ providers: [{ provide: MeApiService, useValue: { me } }] });
  });
  async function settle() {
    TestBed.tick();
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  it('shares one connection, refreshes on reconnect, and stops when the last consumer leaves', async () => {
    const live = TestBed.inject(NotificationLive);
    const listener = vi.fn();
    const one = live.changes.subscribe(listener);
    const two = live.changes.subscribe();
    await settle();
    expect(state.hubs).toHaveLength(0);
    me.set({ id: 'member' });
    await settle();
    expect(state.hubs).toHaveLength(1);
    expect(listener).toHaveBeenCalledTimes(1);
    state.hubs[0].onreconnected.mock.calls[0][0]();
    expect(listener).toHaveBeenCalledTimes(2);
    one.unsubscribe();
    expect(state.hubs[0].stop).not.toHaveBeenCalled();
    two.unsubscribe();
    expect(state.hubs[0].stop).toHaveBeenCalledTimes(1);
  });
  it('closes the old account connection on logout and account switching', async () => {
    const subscription = TestBed.inject(NotificationLive).changes.subscribe();
    me.set({ id: 'first' }); await settle();
    me.set({ id: 'second' }); await settle();
    expect(state.hubs).toHaveLength(2);
    expect(state.hubs[0].stop).toHaveBeenCalledTimes(1);
    me.set(null); await settle();
    expect(state.hubs[1].stop).toHaveBeenCalledTimes(1);
    subscription.unsubscribe();
  });
  it('retries a failed initialization and refreshes by HTTP while waiting', async () => {
    vi.useFakeTimers();
    let subscription: { unsubscribe(): void } | undefined;
    try {
      state.buildFailures = 1;
      const listener = vi.fn();
      subscription = TestBed.inject(NotificationLive).changes.subscribe(listener);
      me.set({ id: 'member' });
      TestBed.tick();
      await vi.advanceTimersByTimeAsync(0);
      expect(state.hubs).toHaveLength(0);
      expect(listener).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(15000);
      expect(state.hubs).toHaveLength(1);
      expect(state.hubs[0].start).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledTimes(2);
    } finally {
      subscription?.unsubscribe();
      vi.useRealTimers();
    }
  });
});
