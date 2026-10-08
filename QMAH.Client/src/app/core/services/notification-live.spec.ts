import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { NotificationLive } from './notification-live';
import { MeApiService } from './me-api';

const state = vi.hoisted(() => ({ hubs: [] as any[] }));
vi.mock('@microsoft/signalr', () => ({
  LogLevel: { None: 0 },
  HubConnectionBuilder: class {
    withUrl() { return this; }
    withAutomaticReconnect() { return this; }
    configureLogging() { return this; }
    build() {
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
});
