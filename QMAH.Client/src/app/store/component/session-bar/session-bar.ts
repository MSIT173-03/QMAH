import { Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CART_LOGIN_PROMPT_MESSAGE, DEFAULT_LOGIN_PROMPT_MESSAGE, LoginPrompt } from '../login-prompt/login-prompt';
import { Promobar } from '../promobar/promobar';
import { CartState, injectSiteData } from '../../shared/page-state';
import { CART_PATH } from '../../shared/paths';

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
  /** 登入提示的說明文字；各頁面依使用情境（加入購物車、兌換折價券…）自訂，預設為加入購物車 */
  loginMessage = input(DEFAULT_LOGIN_PROMPT_MESSAGE);

  /** 頂部公告列所需的公告、會員點數與折價券 */
  protected readonly site = injectSiteData();

  private readonly router = inject(Router);
  /** 由頂部列購物車觸發的登入提示使用專屬的說明文字；關閉提示後恢復為頁面自訂的文字 */
  protected readonly promptMessage = signal<string | null>(null);

  /** 點擊頂部列的購物車：已登入前往購物車頁，未登入開啟登入提示 */
  protected onCartLoginRequest(): void {
    this.promptMessage.set(CART_LOGIN_PROMPT_MESSAGE);
    this.cart().requireSignIn(() => this.router.navigateByUrl(CART_PATH));
  }

  /** 登入提示按下「前往登入」 */
  protected onConfirmLogin(): void {
    this.cart().confirmLogin();
    this.promptMessage.set(null);
  }

  /** 登入提示按下「取消」 */
  protected onCancelLogin(): void {
    this.cart().cancelLogin();
    this.promptMessage.set(null);
  }
}
