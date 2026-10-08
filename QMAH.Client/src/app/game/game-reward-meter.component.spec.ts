import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { GameRewardMeterComponent } from './game-reward-meter.component';
import { GameService } from './game.service';
import { KeyService } from '../services/key-service';
import { MeApiService, Me } from '../core/services/me-api';

describe('GameRewardMeterComponent session checks', () => {
  it('requests personal reward data only after a member is confirmed', async () => {
    const me = signal<Me | null>(null);
    const rewards = vi.fn(() => of(null));
    const economy = vi.fn(() => of({ keyProgressBalance: 0, keyProgressToNormalKey: 100 }));
    await TestBed.configureTestingModule({ imports: [GameRewardMeterComponent], providers: [
      { provide: MeApiService, useValue: { me } },
      { provide: GameService, useValue: { getMiniGameRewardStatus: rewards } },
      { provide: KeyService, useValue: { getEconomy: economy } },
    ] }).compileComponents();
    const fixture = TestBed.createComponent(GameRewardMeterComponent);
    fixture.detectChanges();
    expect(rewards).not.toHaveBeenCalled();
    expect(economy).not.toHaveBeenCalled();
    me.set({ id: 'member' } as Me);
    fixture.detectChanges();
    expect(rewards).toHaveBeenCalledTimes(1);
    expect(economy).toHaveBeenCalledTimes(1);
    me.set(null);
    fixture.detectChanges();
    expect(fixture.componentInstance.keys()).toBeNull();
    expect(economy).toHaveBeenCalledTimes(1);
  });
});
