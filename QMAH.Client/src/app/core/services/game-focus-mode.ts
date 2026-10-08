import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

/** 專注模式：隱藏站台頁首頁尾，並要求瀏覽器進入全螢幕（等同按 F11）。 */
@Injectable({ providedIn: 'root' })
export class GameFocusMode {
  private readonly document = inject(DOCUMENT);
  readonly active = signal(false);

  constructor() {
    // 玩家按 Esc 或用瀏覽器離開全螢幕時，專注模式一併結束
    this.document.addEventListener('fullscreenchange', () => { if (!this.document.fullscreenElement && this.active()) this.active.set(false); });
    // 其他程式只改 active 時，全螢幕也跟著收掉
    effect(() => { if (!this.active() && this.document.fullscreenElement) void this.document.exitFullscreen().catch(() => undefined); });
  }

  toggle(): void {
    const next = !this.active();
    this.active.set(next);
    // 進入全螢幕必須由使用者操作觸發；失敗（例如 iOS Safari 不支援）時仍保留隱藏頁首頁尾的專注模式
    if (next) void this.document.documentElement.requestFullscreen?.().catch(() => undefined);
  }

  exit(): void { this.active.set(false); }
}
