import { NgTemplateOutlet } from '@angular/common';
import { Component, input } from '@angular/core';
import { StoreLink } from '../../shared/store-link';

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
 * full 版（首頁專用）另外顯示品牌介紹與連結欄位；固定資訊只保留目前確實存在的專案入口。
 */
@Component({
  selector: 'app-site-footer',
  imports: [StoreLink, NgTemplateOutlet],
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

  /** 以下為全站一致的品牌與聯絡入口，不隨頁面變動，故不對外開放 */
  // ui-integration: Footer 與 Store Header 共用部署內的品牌資產，不讓正式網站依賴 GitHub raw 圖片。
  protected readonly logoSrc = '/images/brand/qmah-logo.svg';
  protected readonly logoAlt = '清明鑑定屋';
  protected readonly brandNote = '以文物資料為起點，整理探索、遊戲、社群與選物。';
  protected readonly githubUrl = 'https://github.com/MSIT173-03/QMAH';
  protected readonly copyright = '© 2026 QMAH · 清明鑑定屋';
  // ui-integration: 政策入口改用前台實際 route；頁面內容會明確標示展示網站適用範圍，不製造不存在的法律服務承諾。
  protected readonly privacyHref = '/privacy-policy';
  protected readonly termsHref = '/terms';
}
