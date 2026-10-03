import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { locatorTarget } from './game-detail-locator';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { GameTrainingComponent } from './game-training.component';
import { GameService } from './game.service';
import { CatalogService } from '../services/catalog-service';
import { MiniGameStart } from './game.models';

function setup(modeCode: string) {
  const complete = vi.fn(() => of({ normalizedScore: 40, rawScore: 100, grade: 'C', pointReward: 0, keyProgressReward: 1 }));
  TestBed.configureTestingModule({ imports: [GameTrainingComponent], providers: [provideRouter([]), provideHttpClient(),
    { provide: GameService, useValue: { completeMiniGame: complete, errorMessage: () => '連線中斷' } },
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
  it('送出失敗後重送同一份結果，保留提示紀錄且不能更改答案', () => {
    const { component, complete } = setup('DETAIL_LOCATOR');
    component.useHelp(false);
    for (const artifact of component.locatorOptions) component.locateDetail({ artifactId: artifact.artifactId, imageWidth: 1000, imageHeight: 1000, ...locatorTarget(component.attempt!.seed, artifact.artifactId) });
    complete.mockImplementationOnce(() => throwError(() => new Error('連線中斷')));
    component.completeAttempt();
    expect(component.phase).toBe('playing');
    expect(component.resultFrozen).toBe(true);
    expect(component.hintsUsed).toBe(1);
    component.locateDetail({ artifactId: 'a2', x: 0, y: 0, imageWidth: 1000, imageHeight: 1000 });
    expect(component.locatorAnswers).toHaveLength(4);
    component.retryAction();
    expect(complete).toHaveBeenCalledTimes(2);
    expect(complete.mock.calls[1]).toEqual(complete.mock.calls[0]);
    expect(component.phase).toBe('complete');
  });

  it('先協助一片後再代完成，顯示累計進位的新增扣分', () => {
    const { component } = setup('ARTIFACT_PUZZLE');
    component.autoPlaced = 1;
    component.puzzleOrder = Array.from({ length: 25 }, (_, index) => index === 24 ? -1 : index);
    expect(component.helpPenalty).toBe(2);
  });
  it('暫停與結果重送期間，不能透過元件操作改動已凍結的答案', () => {
    const { component } = setup('DETAIL_LOCATOR');
    component.paused = true;
    component.locateDetail({ artifactId: 'a0', x: .5, y: .5, imageWidth: 1000, imageHeight: 1000 });
    expect(component.locatorAnswers).toEqual([]);
    component.paused = false;
    component['pendingResult'] = { rawScore: 100, rawResultJson: '{}' };
    component.locateDetail({ artifactId: 'a0', x: .5, y: .5, imageWidth: 1000, imageHeight: 1000 });
    expect(component.locatorAnswers).toEqual([]);
    component.attempt!.modeCode = 'MEMORY_MATCH';
    component.flipMemory(0);
    expect(component.memoryCards[0].revealed).toBe(false);
  });
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
  it('定位提示標示目前文物區域，同一件重看不扣第二次', () => {
    const { component, complete } = setup('DETAIL_LOCATOR');
    component.useHelp(false);
    component.useHelp(false);
    expect(component.locatorHintArtifactId).toBe('a0');
    expect(component.hintsUsed).toBe(1);
    expect(component.locatorAnswers).toEqual([]);
    expect(complete).not.toHaveBeenCalled();
    component.locateDetail({ artifactId: 'a0', imageWidth: 1000, imageHeight: 1000, ...locatorTarget('seed', 'a0') });
    expect(component.locatorHintArtifactId).toBeNull();
    component.useHelp(false);
    expect(component.locatorHintArtifactId).toBe('a1');
    expect(component.hintsUsed).toBe(2);
  });
  it('代完成只協助剩餘文物，送出 v4 座標與輔助數量', () => {
    const { component, complete } = setup('DETAIL_LOCATOR');
    component.locateDetail({ artifactId: 'a0', imageWidth: 1000, imageHeight: 1000, ...locatorTarget('seed', 'a0') });
    component.useHelp(true);
    expect(component.autoPlaced).toBe(3);
    expect(component.canAskForHelp).toBe(false);
    expect(component.locatorAnswers).toHaveLength(1);
    expect(component.locatorAssistedIds).toEqual(['a1', 'a2', 'a3']);
    expect(complete).toHaveBeenCalledTimes(1);
    const request = complete.mock.calls[0] as unknown as [string, { rawResultJson: string }];
    expect(JSON.parse(request[1].rawResultJson)).toMatchObject({ scoringVersion: 4, autoPlaced: 3, locatorAnswers: component.locatorAnswers });
  });
  it('拒絕越界、重複及跳題座標；四件定位完成才可結算', () => {
    const { component, complete } = setup('DETAIL_LOCATOR');
    component.locateDetail({ artifactId: 'a1', x: .5, y: .5, imageWidth: 1000, imageHeight: 1000 });
    component.locateDetail({ artifactId: 'a0', x: 1.1, y: .5, imageWidth: 1000, imageHeight: 1000 });
    expect(component.locatorAnswers).toEqual([]);
    expect(component.canComplete).toBe(false);
    component.locateDetail({ artifactId: 'a0', imageWidth: 1000, imageHeight: 1000, ...locatorTarget('seed', 'a0') });
    component.locateDetail({ artifactId: 'a0', x: .5, y: .5, imageWidth: 1000, imageHeight: 1000 });
    expect(component.locatorAnswers).toHaveLength(1);
    for (const artifact of component.locatorOptions.slice(1)) component.locateDetail({ artifactId: artifact.artifactId, imageWidth: 1000, imageHeight: 1000, x: 0, y: 0 });
    expect(component.canComplete).toBe(true);
    component.completeAttempt();
    const request = complete.mock.calls[0] as unknown as [string, { rawScore: number }];
    expect(request[1].rawScore).toBe(25);
  });
});
