import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

/**
 * App Shell 共用頁尾：所有主要 Area 使用同一組品牌、導覽與政策入口，
 * 讓首頁與深層頁保有同一個回路，不再由 Store 單獨擁有 footer。
 */
@Component({
  selector: 'app-site-footer',
  imports: [RouterLink],
  templateUrl: './site-footer.html',
  styleUrls: [
    './site-footer.scss',
  ],
})
export class SiteFooter {
  // ui-integration: Footer 與 App Shell 共用部署內的品牌資產，不讓正式網站依賴外部圖片。
  protected readonly logoSrc = '/images/brand/qmah-logo.svg';
  protected readonly logoAlt = '清明鑑定屋';
  protected readonly brandNote = '以文物資料為本，匯集圖鑑、遊戲、社群與選物。';
  protected readonly githubUrl = 'https://github.com/MSIT173-03/QMAH';
  protected readonly copyright = '© 2026 清明鑑定屋';
  protected readonly columns: readonly FooterColumn[] = [
    {
      title: '探索與玩法',
      links: [
        { label: '首頁', href: '/home' },
        { label: '文物圖鑑', href: '/artifact-list' },
        { label: '遊戲大廳', href: '/game' },
        { label: '玩法說明', href: '/game/how-to' },
      ],
    },
    {
      title: '社群與選物',
      links: [
        { label: '社群廣場', href: '/social/posts' },
        { label: '社群活動', href: '/social/events' },
        { label: '站方公告', href: '/social/announcements' },
        { label: '購物商城', href: '/store' },
      ],
    },
    {
      title: '會員服務',
      links: [
        { label: '會員中心', href: '/member' },
        { label: '鑰匙背包', href: '/key-list' },
        { label: '通知中心', href: '/member/notifications' },
        { label: '購物車', href: '/store/cart' },
      ],
    },
    {
      title: '網站資訊',
      links: [
        { label: '隱私權政策', href: '/privacy-policy' },
        { label: '服務條款', href: '/terms' },
        { label: 'GitHub 專案', href: this.githubUrl, external: true },
      ],
    },
  ];
}
