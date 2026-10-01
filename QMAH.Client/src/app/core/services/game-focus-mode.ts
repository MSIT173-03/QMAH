import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class GameFocusMode {
  readonly active = signal(false);
  toggle(): void { this.active.update(active => !active); }
  exit(): void { this.active.set(false); }
}
