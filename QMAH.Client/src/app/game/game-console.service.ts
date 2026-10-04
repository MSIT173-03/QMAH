import { DOCUMENT } from '@angular/common';
import { Injectable, NgZone, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';

export type ConsoleInputMode = 'pointer' | 'keyboard' | 'gamepad';
type Direction = 'up' | 'down' | 'left' | 'right';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
const TEXT_FIELD = 'input:not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]), textarea, select, [contenteditable="true"]';
const OWN_ARROWS = '[role="slider"], [role="application"], [data-console-ignore]';
const GAME_HOST = 'app-game-lobby, app-game-room, app-game-training, app-game-guide, app-game-appreciation, app-game-account, app-game-test';
const DIRECTION_KEYS: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

// 主機式操作：方向鍵／手把方向在畫面上做空間移動，Enter／A 確認，Esc／B 返回，Q／E 與 LB／RB 切換遊戲分頁。
// 各頁自己的方向鍵處理（輪播、棋盤）先執行，已處理的事件這裡不再介入。
@Injectable({ providedIn: 'root' })
export class GameConsole {
  private readonly document = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  private users = 0;
  private cleanup: (() => void) | null = null;
  private frame = 0;
  private readonly pressed = new Set<number>();
  private lastMove = 0;

  readonly mode = signal<ConsoleInputMode>('pointer');
  readonly gamepad = signal(false);
  /** Q／E 或 LB／RB：-1 上一個分頁，1 下一個分頁。 */
  readonly tabStep$ = new Subject<-1 | 1>();

  /** 頁面進場時呼叫，回傳的函式在離開時呼叫；多個元件同時使用時只註冊一次監聽。 */
  attach(): () => void {
    if (typeof window === 'undefined') return () => undefined;
    if (this.users++ === 0) this.start();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (--this.users === 0) this.stop();
    };
  }

  private start(): void {
    const win = this.document.defaultView!;
    const onKey = (event: KeyboardEvent) => this.onKey(event);
    const onPointer = () => this.setMode('pointer');
    const onPad = () => this.zone.runOutsideAngular(() => this.syncGamepads());
    win.addEventListener('keydown', onKey);
    win.addEventListener('pointerdown', onPointer, { passive: true });
    win.addEventListener('gamepadconnected', onPad);
    win.addEventListener('gamepaddisconnected', onPad);
    this.syncGamepads();
    this.cleanup = () => {
      win.removeEventListener('keydown', onKey);
      win.removeEventListener('pointerdown', onPointer);
      win.removeEventListener('gamepadconnected', onPad);
      win.removeEventListener('gamepaddisconnected', onPad);
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    };
  }

  private stop(): void {
    this.cleanup?.();
    this.cleanup = null;
    this.mode.set('pointer');
  }

  private setMode(mode: ConsoleInputMode): void {
    if (this.mode() !== mode) this.zone.run(() => this.mode.set(mode));
  }

  private onKey(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement | null;
    const typing = !!target?.closest(TEXT_FIELD);
    const direction = DIRECTION_KEYS[event.key];
    if (direction) {
      this.setMode('keyboard');
      if (typing || target?.closest(OWN_ARROWS)) return;
      if (this.move(direction)) event.preventDefault();
      return;
    }
    if (typing) return;
    const key = event.key.toLowerCase();
    if (key === 'q' || key === 'e') {
      if (this.document.querySelector('dialog[open], [aria-modal="true"]')) return;
      this.setMode('keyboard');
      this.zone.run(() => this.tabStep$.next(key === 'q' ? -1 : 1));
    } else if (event.key === 'Tab' || event.key === 'Enter' || event.key === ' ') {
      this.setMode('keyboard');
    }
  }

  /** 依畫面位置把焦點移到指定方向最近的控制項；有移動回傳 true。 */
  move(direction: Direction): boolean {
    const scope = this.scope();
    const candidates = this.focusables(scope);
    if (!candidates.length) return false;
    const active = this.document.activeElement as HTMLElement | null;
    const current = active && active !== this.document.body && scope.contains(active) ? active : null;
    if (!current) {
      (candidates.find(candidate => candidate.closest(GAME_HOST)) ?? candidates[0]).focus({ preventScroll: false });
      return true;
    }
    const from = current.getBoundingClientRect();
    const fx = from.left + from.width / 2;
    const fy = from.top + from.height / 2;
    let best: HTMLElement | null = null;
    let bestScore = Infinity;
    for (const candidate of candidates) {
      if (candidate === current) continue;
      const rect = candidate.getBoundingClientRect();
      const dx = rect.left + rect.width / 2 - fx;
      const dy = rect.top + rect.height / 2 - fy;
      const along = direction === 'right' ? dx : direction === 'left' ? -dx : direction === 'down' ? dy : -dy;
      const across = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
      if (along <= 4) continue;
      const score = along + across * 2.2;
      if (score < bestScore) { bestScore = score; best = candidate; }
    }
    if (!best) return false;
    best.focus({ preventScroll: false });
    best.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return true;
  }

  private scope(): ParentNode & Node {
    const dialogs = Array.from(this.document.querySelectorAll<HTMLElement>('dialog[open], [role="dialog"][aria-modal="true"]'))
      .filter(element => element.getClientRects().length > 0);
    return dialogs.at(-1) ?? this.document.body;
  }

  private focusables(scope: ParentNode): HTMLElement[] {
    return Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(element => {
      if (element.closest('[hidden], [inert], .app-skip-link')) return false;
      const rect = element.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return false;
      const style = getComputedStyle(element);
      return style.visibility !== 'hidden' && style.display !== 'none';
    });
  }

  // ── 手把 ──
  private syncGamepads(): void {
    const pads = (navigator.getGamepads?.() ?? []).filter(pad => !!pad);
    const connected = pads.length > 0;
    if (connected !== this.gamepad()) this.zone.run(() => this.gamepad.set(connected));
    if (connected && !this.frame) this.zone.runOutsideAngular(() => { this.frame = requestAnimationFrame(() => this.poll()); });
    if (!connected) { cancelAnimationFrame(this.frame); this.frame = 0; }
  }

  private poll(): void {
    this.frame = 0;
    const pad = (navigator.getGamepads?.() ?? []).find(item => !!item);
    if (!pad) { this.syncGamepads(); return; }
    const down = (index: number) => !!pad.buttons[index]?.pressed;
    const edge = (index: number) => {
      const isDown = down(index);
      const was = this.pressed.has(index);
      if (isDown) this.pressed.add(index); else this.pressed.delete(index);
      return isDown && !was;
    };
    const now = performance.now();
    const x = pad.axes[0] ?? 0;
    const y = pad.axes[1] ?? 0;
    let direction: Direction | null = null;
    if (down(12) || y < -.6) direction = 'up';
    else if (down(13) || y > .6) direction = 'down';
    else if (down(14) || x < -.6) direction = 'left';
    else if (down(15) || x > .6) direction = 'right';
    if (direction && now - this.lastMove > (this.lastMove === 0 ? 0 : 190)) {
      this.lastMove = now;
      this.setMode('gamepad');
      this.zone.run(() => this.move(direction!));
    }
    if (!direction) this.lastMove = 0;
    if (edge(0)) { this.setMode('gamepad'); (this.document.activeElement as HTMLElement | null)?.click(); }
    if (edge(1)) {
      this.setMode('gamepad');
      const target = (this.document.activeElement ?? this.document.body) as HTMLElement;
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
    }
    const previousTab = edge(4), nextTab = edge(5);
    if (!this.document.querySelector('dialog[open], [aria-modal="true"]')) {
      if (previousTab) this.zone.run(() => this.tabStep$.next(-1));
      if (nextTab) this.zone.run(() => this.tabStep$.next(1));
    }
    this.frame = requestAnimationFrame(() => this.poll());
  }
}
