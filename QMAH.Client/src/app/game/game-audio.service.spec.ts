import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameAudio } from './game-audio.service';

describe('遊戲音訊生命週期', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.removeItem('qmah.game.audio');
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  });
  afterEach(() => { TestBed.resetTestingModule(); vi.restoreAllMocks(); vi.useRealTimers(); });

  it('關閉後立刻重新開啟音樂，舊淡出不能暫停目前曲目', async () => {
    const audio = TestBed.inject(GameAudio);
    const release = audio.attach();
    await Promise.resolve();
    vi.advanceTimersByTime(300);
    audio.toggleMusic();
    audio.toggleMusic();
    await Promise.resolve();
    vi.advanceTimersByTime(2000);
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
    release();
    vi.advanceTimersByTime(2000);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });

  it('attach 清理可重入，最後一頁離開才停止音訊', async () => {
    const audio = TestBed.inject(GameAudio);
    const first = audio.attach(), second = audio.attach();
    await Promise.resolve();
    first(); first();
    vi.advanceTimersByTime(1000);
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
    second();
    vi.advanceTimersByTime(2000);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });

  it('淡入期間調整音量後，不被舊計時器拉回', async () => {
    const audio = TestBed.inject(GameAudio);
    const release = audio.attach();
    await Promise.resolve();
    vi.advanceTimersByTime(120);
    const tracks = (audio as unknown as { tracks: Map<string, HTMLAudioElement> }).tracks;
    const track = tracks.get('music-cafe.ogg')!;
    audio.setMusicVolume(.1);
    vi.advanceTimersByTime(2000);
    expect(track.volume).toBeCloseTo(.045);
    release();
  });
});
