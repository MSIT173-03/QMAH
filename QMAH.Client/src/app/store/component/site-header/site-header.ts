import { Component, input } from '@angular/core';
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
  protected readonly logoSrc =
    'https://raw.githubusercontent.com/MSIT173-03/QMAH/main/QMAH.Web/wwwroot/images/brand/qmah-logo.svg';
  protected readonly logoAlt = '清明鑑定屋';
}
