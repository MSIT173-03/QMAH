import { Component, input } from '@angular/core';

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

/**
 * 網站頁尾：simple 版僅顯示底部版權列（列表／商品／購物車／結帳／個人頁面共用），
 * full 版（首頁專用）另外顯示品牌介紹與連結欄位；品牌與客服等全站固定資訊由元件內部維護，不對外開放設定。
 */
@Component({
  selector: 'app-site-footer',
  imports: [],
  templateUrl: './site-footer.html',
  styleUrls: [
    './site-footer.scss',
  ],
})
export class SiteFooter {
  /** simple：僅顯示底部版權列（列表／商品／購物車／結帳／個人頁面共用）；full：首頁專用，含品牌與連結欄位 */
  variant = input<'simple' | 'full'>('simple');

  /** 連結欄位資料（full 版面顯示），由使用端傳入 */
  columns = input<FooterColumn[]>([]);

  /** 以下為全站一致的品牌與客服資訊，不隨頁面變動，故不對外開放 */
  protected readonly logoSrc =
    'https://raw.githubusercontent.com/MSIT173-03/QMAH/main/QMAH.Web/wwwroot/images/brand/qmah-logo.svg';
  protected readonly logoAlt = '清明鑑定屋';
  protected readonly brandNote = '與博物館授權合作，考據為本的文物周邊選物。';
  protected readonly copyright = '© 2026 QMAH · 清明鑑定屋';
  protected readonly privacyHref = '#';
  protected readonly termsHref = '#';
  protected readonly serviceNote = '客服 0800-000-168 · 09:00–21:00';
}
