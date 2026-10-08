import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../../core/services/theme';

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
  // ui-integration: Footer 與 App Shell 共用部署內的品牌資產，並依主題使用正確的 Logo 版本。
  private readonly themeService = inject(ThemeService);
  protected readonly logoSrc = computed(() => this.themeService.theme() === 'qmahdark'
    ? '/images/brand/qmah-logo-dark.svg'
    : '/images/brand/qmah-logo.svg');
  protected readonly logoAlt = '清明鑑定屋';
  protected readonly copyright = '© 2026 清明鑑定屋';
  protected readonly columns: readonly FooterColumn[] = [
    {
      title: '探索與交流',
      links: [
        { label: '文物圖鑑', href: '/artifact-list' },
        { label: '遊戲大廳', href: '/game' },
        { label: '社群廣場', href: '/social/posts' },
      ],
    },
    {
      title: '商城與會員',
      links: [
        { label: '點數與鑰匙', href: '/member/economy' },
        { label: '購物商城', href: '/store' },
        { label: '會員中心', href: '/member' },
      ],
    },
    {
      title: '服務與支援',
      links: [
        { label: '隱私權政策', href: '/privacy-policy' },
        { label: '服務條款', href: '/terms' },
        { label: '聯絡我們', href: 'https://github.com/MSIT173-03/QMAH/issues', external: true },
      ],
    },
  ];
}
