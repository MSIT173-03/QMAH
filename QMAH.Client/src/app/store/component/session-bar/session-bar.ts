import { Component, input } from '@angular/core';
import { LoginPrompt } from '../login-prompt/login-prompt';
import { Promobar } from '../promobar/promobar';
import { CartState, injectSiteData } from '../../shared/page-state';

/**
 * 商城頁面共用的會員工具列：頂部公告列（公告、點數、折價券、購物車件數），
 * 以及未登入時使用會員功能（例如加入購物車）跳出的登入提示。
 * 公告與會員資料由本元件自行取得；購物車件數、登入狀態與登入提示則沿用頁面持有的購物車狀態，
 * 讓頁面上的加入購物車操作與此處的提示共用同一份狀態。
 * :host 為 display: contents，公告列在版面上仍直接位於頁面之下。
 */
@Component({
  selector: 'app-session-bar',
  imports: [Promobar, LoginPrompt],
  templateUrl: './session-bar.html',
  styleUrl: './session-bar.scss',
})
export class SessionBar {
  /** 頁面持有的購物車狀態（injectCartState） */
  cart = input.required<CartState>();

  /** 頂部公告列所需的公告、會員點數與折價券 */
  protected readonly site = injectSiteData();
}
