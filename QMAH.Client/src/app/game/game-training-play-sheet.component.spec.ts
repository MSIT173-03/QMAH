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
    expect(page.querySelector('.play-footer')).not.toBeNull();
    expect(page.querySelector('.play-footer .play-instruction')).toBeNull();
    expect(page.querySelector('.play-context')?.nextElementSibling?.classList.contains('game-board')).toBe(true);
    expect(page.querySelectorAll('.play-formal-link')).toHaveLength(1);
    expect(page.querySelector('.play-formal-link')?.getAttribute('href')).toContain(`game=${code}`);
    expect(page.textContent).not.toContain('送出結果');
    fixture.componentRef.setInput('canComplete', true);
    fixture.componentRef.setInput('resultFrozen', true);
    fixture.detectChanges();
    expect(page.textContent).not.toContain('完成展示');
    expect(page.textContent).toContain('展示完成');
  });

  it.each(modes)('%s 正式挑戰共用暫停、評分與送出位置，未完成不可送出', code => {
    const fixture = render(code, false);
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('.play-mode-label')?.textContent).toContain('正式挑戰');
    expect(page.querySelector('.pause-trigger')?.textContent).toContain('暫停挑戰');
    expect(page.querySelector('app-game-scoring-guide')).not.toBeNull();
    expect(page.querySelector('.play-instruction')?.textContent?.length).toBeGreaterThan(5);
    expect(page.querySelector<HTMLButtonElement>('.play-actions [data-button-tone="start"]')?.disabled).toBe(true);
    fixture.componentRef.setInput('canComplete', true);
    fixture.detectChanges();
    expect(page.querySelector<HTMLButtonElement>('.play-actions [data-button-tone="start"]')?.disabled).toBe(false);
  });
});
