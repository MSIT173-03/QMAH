import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameTrainingDemoComponent } from './game-training-demo.component';
import { GameTrainingPlaySheetComponent } from './game-training-play-sheet.component';

describe('玩法試玩模式', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient()] });
  });
  afterEach(() => { TestBed.resetTestingModule(); vi.restoreAllMocks(); vi.useRealTimers(); });

  function start(modeCode = 'ARTIFACT_PUZZLE') {
    const fixture = TestBed.createComponent(GameTrainingDemoComponent);
    fixture.componentRef.setInput('modeCode', modeCode);
    fixture.componentInstance.ngOnChanges();
    const step = vi.fn();
    fixture.componentInstance['playSheet'] = { advanceDemonstration: step } as unknown as GameTrainingPlaySheetComponent;
    return { demo: fixture.componentInstance, step };
  }

  it('進入與重新試玩皆為人工操作，不會自行推進盤面', () => {
    const { demo, step } = start();
    vi.advanceTimersByTime(5000);
    expect(demo.autoPlaying).toBe(false);
    expect(step).not.toHaveBeenCalled();
    demo.toggleAutoPlay();
    demo.restartDemo();
    expect(demo.autoPlaying).toBe(false);
  });

  it('細節追跡每秒推進定位、選定與確認，評語播放時停止推進', () => {
    const { demo, step } = start('DETAIL_LOCATOR');
    demo.toggleAutoPlay();
    vi.advanceTimersByTime(4000);
    expect(step).toHaveBeenCalledTimes(3);
    demo.locatorReviewing = true;
    vi.advanceTimersByTime(1500);
    expect(step).toHaveBeenCalledTimes(3);
    demo.locatorReviewing = false;
    vi.advanceTimersByTime(1000);
    expect(step).toHaveBeenCalledTimes(4);
  });

  it('自動操作每秒一步，計時仍按秒更新，暫停不推進', () => {
    const { demo, step } = start();
    demo.toggleAutoPlay();
    vi.advanceTimersByTime(2000);
    expect(step).toHaveBeenCalledTimes(1);
    expect(demo.elapsedSeconds).toBe(2);
    vi.advanceTimersByTime(500);
    expect(step).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(500);
    expect(step).toHaveBeenCalledTimes(2);
    demo.paused = true;
    vi.advanceTimersByTime(3000);
    expect(step).toHaveBeenCalledTimes(2);
    expect(demo.elapsedSeconds).toBe(3);
  });
});
