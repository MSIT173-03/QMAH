import { Component, input } from '@angular/core';

/** 頁首導覽連結 */
export interface HeaderNavLink {
  label: string;
  href: string;
}

/**
 * 頁首右側的操作區：左半為分類／主題導覽連結，右半由使用端以 ng-content 投影
 * （購物車入口、購物車件數說明等）。
 * 投影至 app-site-header 內使用，本身只負責推擠至右側並排列這兩段內容。
 */
@Component({
  selector: 'app-header-actions',
  imports: [],
  templateUrl: './header-actions.html',
  styleUrls: [
    './header-actions.scss',
  ],
})
export class HeaderActions {
  /** 導覽連結清單，順序即顯示順序 */
  links = input<HeaderNavLink[]>([]);
}
