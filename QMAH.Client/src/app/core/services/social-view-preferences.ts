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
  private readPreference(): boolean {
    try { return this.document.defaultView?.localStorage.getItem(this.storageKey) === 'wide'; } catch { return false; }
  }
  private applyWidth(): void {
    this.document.documentElement.style.setProperty('--qmah-social-width', this.wide() ? '1600px' : '1120px');
  }
}
