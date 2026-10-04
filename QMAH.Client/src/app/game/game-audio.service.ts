import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type GameSound = 'click' | 'select' | 'place' | 'flip' | 'success' | 'error' | 'win' | 'reveal';
export type GameMusicScene = 'hall' | 'play';

const STORAGE_KEY = 'qmah.game.audio';
const BASE = '/assets/game/audio/';
// 音效：Kenney Casino Audio（CC0）；音樂：Tabletop Jazz Cafe（Ludo Loon Studio）。來源見 audio/CREDITS.txt
const SOUND_VOLUME: Record<GameSound, number> = { click: .6, select: .6, place: .7, flip: .6, success: .7, error: .6, reveal: .65, win: .8 };
const MUSIC_LIST: Record<GameMusicScene, string[]> = {
  hall: ['music-cafe.ogg'],
  play: ['music-cafe.ogg']
};
const MUSIC_VOLUME = .45;

/**
  * 音效為 CC0，背景音樂授權見素材目錄 CREDITS.txt。音樂與音效各自可關，設定存在瀏覽器；
 * 瀏覽器要求先有使用者操作才能出聲，所以第一次點擊之後音樂才會開始。
 */
@Injectable({ providedIn: 'root' })
export class GameAudio {
  private readonly document = inject(DOCUMENT);
  readonly musicOn = signal(true);
  readonly sfxOn = signal(true);
  readonly musicVolume = signal(.6);
  readonly sfxVolume = signal(.8);
  readonly scene = signal<GameMusicScene>('hall');
  private users = 0;
  private cleanup: (() => void) | null = null;
  private readonly sounds = new Map<GameSound, HTMLAudioElement>();
  private readonly tracks = new Map<string, HTMLAudioElement>();
  private readonly position: Record<GameMusicScene, number> = { hall: 0, play: 0 };
  private playing: HTMLAudioElement | null = null;
  private fade = 0;
  private readonly fadeOutTimers = new Map<HTMLAudioElement, number>();
  private readonly activeSounds = new Set<HTMLAudioElement>();

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as { music?: boolean; sfx?: boolean; musicVolume?: number; sfxVolume?: number };
      if (typeof saved.music === 'boolean') this.musicOn.set(saved.music);
      if (typeof saved.sfx === 'boolean') this.sfxOn.set(saved.sfx);
      if (typeof saved.musicVolume === 'number') this.musicVolume.set(Math.min(1, Math.max(0, saved.musicVolume)));
      if (typeof saved.sfxVolume === 'number') this.sfxVolume.set(Math.min(1, Math.max(0, saved.sfxVolume)));
    } catch { /* 沒有儲存空間時用預設值 */ }
  }

  toggleMusic(): void { this.musicOn.update(value => !value); this.persist(); this.syncMusic(); }
  toggleSfx(): void { this.sfxOn.update(value => !value); this.persist(); if (this.sfxOn()) this.play('select'); }
  setMusicVolume(value: number): void {
    window.clearInterval(this.fade);
    this.musicVolume.set(Math.min(1, Math.max(0, value)));
    this.persist();
    if (this.playing) this.playing.volume = MUSIC_VOLUME * this.musicVolume();
  }
  setSfxVolume(value: number): void { this.sfxVolume.set(Math.min(1, Math.max(0, value))); this.persist(); }
  /** 調整音效音量時放一聲讓人聽到大小 */
  previewSfx(): void { this.play('select'); }
  private persist(): void { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ music: this.musicOn(), sfx: this.sfxOn(), musicVolume: this.musicVolume(), sfxVolume: this.sfxVolume() })); } catch { /* 忽略 */ } }

  /** 牌桌與單人遊戲進行中換成另一首音樂；離開時回到選單那首。 */
  useScene(scene: GameMusicScene): () => void {
    this.scene.set(scene);
    this.syncMusic();
    return () => { if (this.scene() === scene) { this.scene.set('hall'); this.syncMusic(); } };
  }

  /** 遊戲頁進場時呼叫；回傳的函式在離開時呼叫，離開遊戲區後音樂自動停止。 */
  attach(): () => void {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return () => undefined;
    if (this.users++ === 0) this.start();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (--this.users === 0) {
        this.cleanup?.(); this.cleanup = null;
        for (const sound of this.activeSounds) sound.pause();
        this.activeSounds.clear();
        this.syncMusic();
      }
    };
  }

  private start(): void {
    const win = this.document.defaultView!;
    // 一般按鈕、連結的點擊音；有些操作另外有專屬音效，標了 data-no-sound 的區塊不重複發聲
    const onClick = (event: Event) => {
      const control = (event.target as HTMLElement | null)?.closest<HTMLElement>('button, a[href], [role="button"], summary');
      this.syncMusic();
      if (!control || (control as HTMLButtonElement).disabled || control.closest('[data-no-sound]')) return;
      this.play('click');
    };
    const onVisibility = () => this.syncMusic();
    win.addEventListener('click', onClick, true);
    this.document.addEventListener('visibilitychange', onVisibility);
    this.cleanup = () => { win.removeEventListener('click', onClick, true); this.document.removeEventListener('visibilitychange', onVisibility); };
    this.syncMusic();
  }

  play(sound: GameSound): void {
    if (!this.sfxOn() || this.users === 0 || this.document.hidden) return;
    let source = this.sounds.get(sound);
    if (!source) { source = new Audio(`${BASE}${sound}.ogg`); source.preload = 'auto'; this.sounds.set(sound, source); }
    // 複製一份再播放，連續點擊時聲音可以重疊
    const instance = source.cloneNode() as HTMLAudioElement;
    instance.volume = Math.min(1, SOUND_VOLUME[sound] * this.sfxVolume());
    this.activeSounds.add(instance);
    const release = () => this.activeSounds.delete(instance);
    instance.addEventListener('ended', release, { once: true });
    instance.addEventListener('error', release, { once: true });
    void Promise.resolve(instance.play()).catch(release);
  }

  // ── 背景音樂 ──
  /** 該場景目前輪到的曲目；一首播完會自動接下一首，最後一首之後回到第一首，永遠循環。 */
  private track(scene: GameMusicScene): HTMLAudioElement {
    const list = MUSIC_LIST[scene];
    const file = list[this.position[scene] % list.length];
    let track = this.tracks.get(file);
    if (!track) {
      track = new Audio(`${BASE}${file}`);
      track.preload = 'none';
      track.loop = true; // 單曲無縫循環；選單與牌桌共用同一首，切換場景時不會重頭開始
      track.volume = 0;
      track.addEventListener('ended', () => {
        this.position[scene] = (this.position[scene] + 1) % list.length;
        if (this.playing === track) { this.playing = null; this.syncMusic(); }
      });
      this.tracks.set(file, track);
    }
    return track;
  }

  private syncMusic(): void {
    const shouldPlay = this.musicOn() && this.users > 0 && !this.document.hidden;
    const wanted = shouldPlay ? this.track(this.scene()) : null;
    if (this.playing && this.playing !== wanted) this.fadeOut(this.playing);
    if (!wanted) { this.playing = null; return; }
    const fading = this.fadeOutTimers.get(wanted);
    if (fading !== undefined) { window.clearInterval(fading); this.fadeOutTimers.delete(wanted); }
    if (wanted === this.playing && !wanted.paused) return;
    this.playing = wanted;
    if (wanted.ended) wanted.currentTime = 0;
    // 沒有使用者操作前瀏覽器會拒絕播放，等下一次點擊再試
    void Promise.resolve(wanted.play()).then(() => {
      if (this.playing === wanted && this.musicOn() && this.users > 0 && !this.document.hidden) this.fadeTo(wanted, MUSIC_VOLUME * this.musicVolume());
    }).catch(() => { if (this.playing === wanted) this.playing = null; });
  }

  private fadeTo(track: HTMLAudioElement, volume: number): void {
    window.clearInterval(this.fade);
    this.fade = window.setInterval(() => {
      const step = (volume - track.volume) / 6;
      track.volume = Math.max(0, Math.min(1, track.volume + step));
      if (Math.abs(volume - track.volume) < .01) { track.volume = volume; window.clearInterval(this.fade); }
    }, 60);
  }

  private fadeOut(track: HTMLAudioElement): void {
    window.clearInterval(this.fade);
    const previous = this.fadeOutTimers.get(track);
    if (previous !== undefined) window.clearInterval(previous);
    const timer = window.setInterval(() => {
      track.volume = Math.max(0, track.volume - .04);
      if (track.volume <= .001) { track.pause(); window.clearInterval(timer); this.fadeOutTimers.delete(track); }
    }, 50);
    this.fadeOutTimers.set(track, timer);
  }
}
