import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type SiteTheme = 'qmah' | 'qmahdark';

/** 共用 QMAH 主題狀態；登入頁與 App Shell 都從同一個 signal 讀寫。 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  readonly theme = signal<SiteTheme>(this.readInitialTheme());

  constructor() {
    this.applyDocumentTheme(this.theme());
  }

  setTheme(theme: SiteTheme): void {
    this.applyDocumentTheme(theme);
    this.theme.set(theme);
  }

  toggleTheme(): void {
    this.setTheme(this.theme() === 'qmahdark' ? 'qmah' : 'qmahdark');
  }

  private readInitialTheme(): SiteTheme {
    try {
      const storedTheme = this.document.defaultView?.localStorage.getItem('qmah-theme');
      if (storedTheme === 'qmah' || storedTheme === 'qmahdark') return storedTheme;
    } catch {
      // 私密瀏覽或受限環境無法讀取儲存時，沿用目前 document theme。
    }

    return this.document.documentElement.getAttribute('data-theme') === 'qmahdark' ? 'qmahdark' : 'qmah';
  }

  private applyDocumentTheme(theme: SiteTheme): void {
    this.document.documentElement.setAttribute('data-theme', theme);
    try {
      this.document.defaultView?.localStorage.setItem('qmah-theme', theme);
    } catch {
      // 主題切換不應因為儲存權限而失敗。
    }
  }
}
