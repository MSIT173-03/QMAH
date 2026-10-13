import { TestBed } from '@angular/core/testing';
import { NavigationStart, Router } from '@angular/router';
import { Subject } from 'rxjs';
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
    audio.toggleMusic();
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
    audio.toggleMusic();
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
    audio.toggleMusic();
    await Promise.resolve();
    vi.advanceTimersByTime(120);
    const tracks = (audio as unknown as { tracks: Map<string, HTMLAudioElement> }).tracks;
    const track = tracks.get('music-cafe.ogg')!;
    audio.setMusicVolume(.1);
    vi.advanceTimersByTime(2000);
    expect(track.volume).toBeCloseTo(.045);
    release();
  });

  it('忽略儲存的播放開關，每次新入口由靜音開始，使用者仍可自行開啟', async () => {
    localStorage.setItem('qmah.game.audio', JSON.stringify({ music: true, sfx: true, musicVolume: .4, sfxVolume: .7 }));
    const audio = TestBed.inject(GameAudio);
    expect(audio.musicOn()).toBe(false);
    expect(audio.sfxOn()).toBe(false);
    expect(audio.musicVolume()).toBe(.4);
    const release = audio.attach();
    expect(audio.muted()).toBe(true);
    audio.play('click');
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    audio.toggleSfx();
    expect(audio.sfxOn()).toBe(true);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    release();
  });

  it('同一個遊戲元件隨路由參數切換時，停止前一場並重設靜音', () => {
    const events = new Subject<unknown>();
    TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: { events } }] });
    const audio = TestBed.inject(GameAudio);
    const release = audio.attach();
    audio.toggleSfx();
    expect(audio.sfxOn()).toBe(true);
    events.next(new NavigationStart(1, '/game/room/next'));
    expect(audio.sfxOn()).toBe(false);
    expect(audio.muted()).toBe(true);
    release();
  });
});
