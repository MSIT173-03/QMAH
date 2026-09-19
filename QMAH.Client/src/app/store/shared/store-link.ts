import { Directive, inject, input } from '@angular/core';
import { Router } from '@angular/router';

/**
 * 站內連結：以網址字串（可含查詢字串與 #錨點）設定 href，點擊時改由 Router 在應用程式內導覽，不重新載入頁面。
 *
 * 不直接使用 routerLink 的原因：routerLink 的字串會被視為路徑片段（? 與 # 會被編碼），
 * 無法接收元件由外部傳入、已含查詢字串的網址；且 "#" 等尚未實作的預留連結需維持瀏覽器原生行為。
 * 因此只有以 / 開頭的站內網址會改由 Router 導覽，其餘（例如 "#"）與按住修飾鍵、另開視窗的點擊皆維持原生行為。
 */
@Directive({
  selector: 'a[storeLink]',
  host: {
    '[attr.href]': 'storeLink()',
    '(click)': 'onClick($event)',
  },
})
export class StoreLink {
  private readonly router = inject(Router);

  /** 連結網址 */
  storeLink = input.required<string>();

  protected onClick(event: MouseEvent): void {
    const url = this.storeLink();
    const modified = event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
    if (!url.startsWith('/') || modified) return;
    event.preventDefault();
    this.router.navigateByUrl(url);
  }
}
