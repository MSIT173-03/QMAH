import { Component, input } from '@angular/core';

/**
 * 商城頁首內容外殼：內容（搜尋框、導覽連結等）由使用端以 ng-content 投影；
 * 品牌 Logo 與跨 Area 主導航由外層 App Shell 統一提供。
 */
@Component({
  selector: 'app-site-header',
  templateUrl: './site-header.html',
  styleUrls: [
    './site-header.scss',
  ],
})
export class SiteHeader {
  /** default：一般頁面；hero：首頁（搜尋框下方有熱門搜尋，故加大下留白）；wrap：結帳頁（僅步驟指示器，間距略窄且可換行） */
  variant = input<'default' | 'hero' | 'wrap'>('default');
}
