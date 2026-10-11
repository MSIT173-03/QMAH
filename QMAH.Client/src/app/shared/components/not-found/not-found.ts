import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { QmahIconComponent } from '../qmah-icon/qmah-icon';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, QmahIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="not-found" aria-labelledby="not-found-title"><div class="lost-mark" aria-hidden="true"><span>4</span><app-qmah-icon name="package-search" [size]="100" /><span>4</span></div><h1 id="not-found-title">你可能走錯位置了</h1><p>找不到這個頁面。網址可能有誤，或原本的頁面已移動。</p><code>{{ path }}</code><a class="home-link" routerLink="/home"><app-qmah-icon name="home" [size]="19" />回到首頁</a><nav aria-label="繼續探索"><a routerLink="/store">逛逛商城<app-qmah-icon name="arrow-right" [size]="16" /></a><a routerLink="/game">前往遊戲大廳<app-qmah-icon name="arrow-right" [size]="16" /></a></nav></section>`,
  styles: `
    :host { display: block; }
    .not-found { min-height: 72vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 56px 24px 72px; color: var(--color-ink, #263239); }
    .lost-mark { display: flex; align-items: center; gap: 22px; margin-bottom: 24px; color: #a67a32; font: 500 clamp(96px, 12vw, 152px)/1 'Noto Serif TC', serif; }
    h1 { margin: 0 0 18px; font-family: 'Noto Serif TC', serif; font-size: clamp(26px, 3vw, 38px); font-weight: 600; }
    p { max-width: 36em; margin: 0 0 18px; line-height: 1.8; color: var(--color-body, #565d60); }
    code { display: block; max-width: min(500px, 90vw); overflow-wrap: anywhere; padding: 9px 14px; font-size: 13px; border: 1px solid var(--color-line-soft, #e5ded3); color: var(--color-muted, #716a60); border-radius: 6px; margin-bottom: 30px; }
    .home-link { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 48px; padding: 0 28px; border-radius: 8px; background: #93691f; color: #fff; font-weight: 600; text-decoration: none; }
    .home-link:hover { background: #77531a; }
    nav { display: flex; flex-wrap: wrap; justify-content: center; gap: 16px 28px; padding-top: 24px; }
    nav a { display: inline-flex; align-items: center; gap: 7px; color: var(--color-body, #565d60); text-decoration: none; }
    nav a:hover { color: #93691f; text-decoration: underline; text-underline-offset: 4px; }
    a:focus-visible { outline: 3px solid #bc9654; outline-offset: 5px; }
    :host-context([data-theme='qmahdark']) .lost-mark { color: #d7b475; }
  `,
})
export class NotFoundComponent { readonly path = inject(Router).url.split('?')[0].split('#')[0]; }
