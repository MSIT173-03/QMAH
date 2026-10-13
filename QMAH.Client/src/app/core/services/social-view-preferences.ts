import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SocialViewPreferences {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = 'qmah.social.width';
  readonly wide = signal(this.readPreference());
  constructor() { this.applyWidth(); }
  toggle(): void {
    this.wide.update(value => !value);
    try { this.document.defaultView?.localStorage.setItem(this.storageKey, this.wide() ? 'wide' : 'standard'); } catch { /* Session choice still applies. */ }
    this.applyWidth();
  }
  // 預設寬版：只有使用者自己切成窄版（儲存值為 standard）才用窄版。
  private readPreference(): boolean {
    try { return this.document.defaultView?.localStorage.getItem(this.storageKey) !== 'standard'; } catch { return true; }
  }
  private applyWidth(): void {
    this.document.documentElement.style.setProperty('--qmah-social-width', this.wide() ? '1600px' : '1120px');
  }
}
