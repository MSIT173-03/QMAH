import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Economy } from './economy';

describe('Economy visual states', () => {
  let component: Economy;
  beforeEach(async () => {
    await TestBed.configureTestingModule({imports: [Economy],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]}).compileComponents();
    component = TestBed.createComponent(Economy).componentInstance;
  });
  it('uses bounded gem counts as points accumulate', () => {
    for (const [points, level, count] of [[0, 'starter', 1], [99, 'starter', 1], [100, 'growing', 3],
      [500, 'abundant', 5], [1000, 'treasury', 7], [2147483647, 'treasury', 7]] as const) {
      component.economy = {pointBalance: points, keyProgressBalance: 0, keyProgressToNormalKey: 100};
      expect(component.pointLevel).toBe(level);
      expect(component.pointGems.length).toBe(count);
    }
  });
  it('highlights progress at 80 percent without claiming a key has been awarded', () => {
    component.economy = {pointBalance: 113, keyProgressBalance: 79, keyProgressToNormalKey: 100};
    expect(component.isKeyAlmostReady).toBe(false);
    component.economy.keyProgressBalance = 80;
    expect(component.isKeyAlmostReady).toBe(true);
    expect(component.remainingKeyProgress).toBe(20);
    component.economy.keyProgressBalance = 100;
    expect(component.isKeyAlmostReady).toBe(false);
    expect(component.conversion).toBeNull();
  });
  it('respects a configurable target and invalid or missing progress', () => {
    expect(component.isKeyAlmostReady).toBe(false);
    component.economy = {pointBalance: 113, keyProgressBalance: 160, keyProgressToNormalKey: 200};
    expect(component.isKeyAlmostReady).toBe(true);
    component.economy.keyProgressToNormalKey = 0;
    expect(component.keyProgressPercent).toBe(0);
    expect(component.isKeyAlmostReady).toBe(false);
  });
});
