import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { GameTrainingComponent } from './game-training.component';
import { GameService } from './game.service';
import { CatalogService } from '../services/catalog-service';
import { MiniGameStart } from './game.models';

function setup(modeCode: string) {
  const complete = vi.fn(() => of({ normalizedScore: 40, rawScore: 100, grade: 'C', pointReward: 0, keyProgressReward: 1 }));
  TestBed.configureTestingModule({ imports: [GameTrainingComponent], providers: [
    { provide: GameService, useValue: { completeMiniGame: complete } },
    { provide: CatalogService, useValue: {} }
  ] });
  const fixture = TestBed.createComponent(GameTrainingComponent);
  const component = fixture.componentInstance;
  component.attempt = { attemptId: 'attempt', modeCode, modeName: modeCode, artifactId: 'a0', artifactName: '館藏', seed: 'seed',
    artifactPool: Array.from({ length: 8 }, (_, i) => ({ artifactId: `a${i}`, name: `館藏${i}`, primaryImagePath: '/image.png', thumbnailPath: null })) } as MiniGameStart;
  component.phase = 'playing';
  component['resetBoard']();
  return { component, complete };
}

describe('單人遊戲求救', () => {
  it('翻牌提示不完成配對，同一組重看不重複扣分', () => {
    const { component, complete } = setup('MEMORY_MATCH');
    component.useHelp(false);
    component.useHelp(false);
    expect(component.hintsUsed).toBe(1);
    expect(component.memoryMatched).toBe(0);
    expect(component.memoryFeedback).toContain('重看不再扣分');
    expect(complete).not.toHaveBeenCalled();
  });
  it('代完成只計剩餘組數，直接送出一次並保留原提示紀錄', () => {
    const { component, complete } = setup('MEMORY_MATCH');
    component.useHelp(false);
    const id = component.memoryCards[0].artifactId;
    component.memoryCards.filter(card => card.artifactId === id).forEach(card => card.matched = true);
    component.memoryMatched = 1;
    component.useHelp(true);
    component.useHelp(true);
    expect(complete).toHaveBeenCalledTimes(1);
    const request = complete.mock.calls[0] as unknown as [string, { rawResultJson: string }];
    expect(JSON.parse(request[1].rawResultJson)).toMatchObject({ scoringVersion: 3, hintsUsed: 1, autoPlaced: 7, memoryMatched: 8 });
  });
  it('細節提示最多排除兩個錯誤選項，仍須作答', () => {
    const { component, complete } = setup('DETAIL_LOCATOR');
    component.useHelp(false);
    component.useHelp(false);
    component.useHelp(false);
    expect(component.locatorExcludedIds).toHaveLength(2);
    expect(component.locatorExcludedIds).not.toContain('a0');
    expect(component.hintsUsed).toBe(2);
    expect(component.locatorChoice).toBeNull();
    expect(complete).not.toHaveBeenCalled();
    component.chooseLocator(component.locatorExcludedIds[0]);
    expect(component.locatorChoice).toBeNull();
  });
  it('求救按鈕不會洩漏細節題答案，代完成仍需扣分並送出', () => {
    const { component, complete } = setup('DETAIL_LOCATOR');
    component.locatorChoice = 'a0';
    expect(component.canAskForHelp).toBe(true);
    component.locatorChoice = 'a1';
    expect(component.canAskForHelp).toBe(true);
    component.useHelp(true);
    expect(component.autoPlaced).toBe(1);
    expect(component.canAskForHelp).toBe(false);
    expect(component.locatorChoice).toBe('a0');
    expect(complete).toHaveBeenCalledTimes(1);
  });
});
