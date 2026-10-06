import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { GameResultTallyComponent } from './game-result-tally.component';
import { MiniGameComplete } from './game.models';

describe('鑰匙結算顯示', () => {
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
