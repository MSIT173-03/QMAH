import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameResultTallyComponent } from './game-result-tally.component';
import { MiniGameComplete } from './game.models';

afterEach(() => vi.useRealTimers());

describe('鑰匙結算顯示', () => {
  it('換得鑰匙持續顯示在原本的鑰匙欄，保持兩張獎勵卡', () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(GameResultTallyComponent);
    const result: MiniGameComplete = {
      attemptId: 'converted', modeCode: 'MEMORY_MATCH', rawScore: 80,
      normalizedScore: 80, grade: 'A', pointReward: 8, keyProgressReward: 7.5,
      keyRewardDivisor: 4, convertedNormalKeys: 2, remainingKeyProgress: 0.5,
      economicRewardGranted: true, alreadyCompleted: false, completedAt: ''
    };
    fixture.componentRef.setInput('complete', result);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.tally-card')).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('＋2 把');
    expect(fixture.nativeElement.querySelector('[data-tone="keys"] [role="status"]')).not.toBeNull();
    vi.advanceTimersByTime(5000);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('＋2 把');
    fixture.componentRef.setInput('complete', { ...result, alreadyCompleted: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('＋2 把');
    fixture.componentRef.setInput('complete', { ...result, convertedNormalKeys: 0 });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
  });
  it.each([0, 0.125, 0.5, 1.25, 8])('保留實際獎勵 %s，不以整數計數器取代小數', reward => {
    const fixture = TestBed.createComponent(GameResultTallyComponent);
    fixture.componentRef.setInput('complete', {
      attemptId: 'result', modeCode: 'DETAIL_LOCATOR', rawScore: 80,
      normalizedScore: 80, grade: 'A', pointReward: 8,
      keyProgressReward: reward, keyRewardDivisor: 4,
      convertedNormalKeys: 0, remainingKeyProgress: 85.5,
      economicRewardGranted: true, alreadyCompleted: false, completedAt: ''
    } satisfies MiniGameComplete);
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('[data-tone="keys"]');
    expect(card.querySelector('.tally-num').textContent).toBe(`+${reward}`);
    expect(card.querySelector('.tally-key-meta').textContent).toContain('85.5／100');
    expect(card.querySelector('.tally-key-meta').textContent).toContain('本局獎勵 × 1/4');
    expect(card.querySelector('.tally-bar i').style.getPropertyValue('--w')).toBe('85.5');
  });
});
