import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, RouterLink } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { GameTrainingPlaySheetComponent } from './game-training-play-sheet.component';
import { MiniGameStart } from './game.models';

const modes = ['DETAIL_LOCATOR', 'MEMORY_MATCH', 'ARTIFACT_PUZZLE', 'STRIP_RESTORE'];
describe('四種玩法的正式挑戰與展示', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.overrideComponent(GameTrainingPlaySheetComponent, {
      set: { imports: [RouterLink], schemas: [NO_ERRORS_SCHEMA] }
    });
  });

  function render(code: string, demo: boolean) {
    const fixture = TestBed.createComponent(GameTrainingPlaySheetComponent);
    fixture.componentRef.setInput('attempt', {
      attemptId: 'ui', modeCode: code, modeName: code, artifactId: 'artifact',
      artifactName: '文物', primaryImagePath: '', thumbnailPath: null,
      seed: 'ui-e', difficulty: 'EASY', configJson: null, startedAt: '', artifactPool: []
    } as MiniGameStart);
    fixture.componentRef.setInput('demonstration', demo);
    fixture.detectChanges();
    return fixture;
  }

  it.each(modes)('%s 展示明確標示不計獎勵，正式入口保留目前玩法', code => {
    const fixture = render(code, true);
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('.play-mode-label')?.textContent).toContain('玩法展示 · 不計成績與獎勵');
    expect(page.querySelector('.play-footer')).toBeNull();
    expect(page.querySelector('.play-formal-link')).toBeNull();
    expect(page.querySelector('.play-context')?.nextElementSibling?.classList.contains('game-board')).toBe(true);
    expect(page.textContent).not.toContain('送出結果');
    fixture.componentRef.setInput('canComplete', true);
    fixture.componentRef.setInput('resultFrozen', true);
    fixture.detectChanges();
    expect(page.textContent).not.toContain('完成展示');
    expect(page.textContent).toContain('展示完成');
  });

  it.each(modes)('%s 正式挑戰共用暫停與評分，完成後暫停鈕變成完成挑戰、可選查看結算或留在頁面', code => {
    const fixture = render(code, false);
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('.play-mode-label')?.textContent).toContain('正式挑戰');
    expect(page.querySelector('.pause-trigger')?.textContent).toContain('暫停挑戰');
    expect(page.querySelector('app-game-scoring-guide')).not.toBeNull();
    expect(page.querySelector('.play-instruction')?.textContent?.length).toBeGreaterThan(5);
    expect(page.querySelector('.finish-trigger')).toBeNull();
    expect(page.querySelector('.play-footer')).toBeNull();
    fixture.componentRef.setInput('canComplete', true);
    fixture.detectChanges();
    expect(page.querySelector('.pause-trigger')).toBeNull();
    expect(page.querySelector('.finish-trigger')?.textContent).toContain('完成挑戰');
    expect(page.querySelector('.finish-dialog')?.textContent).toContain('留在頁面');
  });
});
