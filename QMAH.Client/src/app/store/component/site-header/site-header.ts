import { Component, computed, inject, input } from '@angular/core';
import { ThemeService } from '../../../core/services/theme';
import { StoreLink } from '../../shared/store-link';
import { HOME_PATH } from '../../shared/paths';

/**
 * 商城頁首內容外殼：左側為品牌 Logo，其餘內容（搜尋框、分類、購物車入口等）
 * 由使用端以 ng-content 投影；跨 Area 主導航由外層 App Shell 統一提供。
 */
@Component({
  selector: 'app-site-header',
  imports: [StoreLink],
  templateUrl: './site-header.html',
  styleUrls: [
    './site-header.scss',
  ],
})
export class SiteHeader {
  /** default：一般頁面；hero：首頁（下方接分類導覽列，故加大下留白）；list：商品列表頁（間距較窄且可換行）；wrap：結帳頁（僅品牌與步驟指示器，間距略窄且可換行） */
  variant = input<'default' | 'hero' | 'list' | 'wrap'>('default');

  /** 品牌識別與首頁入口全站一致，不需由各頁面傳入 */
  protected readonly homeHref = HOME_PATH;
  // ui-integration: 使用 Angular public asset 的相對根路徑，避免部署後品牌 Logo 依賴 GitHub raw 網址或開發網路。
  private readonly themeService = inject(ThemeService);
  protected readonly logoSrc = computed(() => this.themeService.theme() === 'qmahdark'
    ? '/images/brand/qmah-logo-dark.svg'
    : '/images/brand/qmah-logo.svg');
  protected readonly logoAlt = '清明鑑定屋';
}
