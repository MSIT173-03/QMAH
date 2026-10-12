import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { QmahIconComponent } from '../qmah-icon/qmah-icon';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, QmahIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./missing-book.vendor.css', './not-found.scss'],
  template: `<section class="lost-page" aria-labelledby="not-found-title">
    <div class="lost-page__scene" aria-hidden="true"><span class="scene-code">404</span><div class="shelf-stage"><div class="shelf"><span class="book home-page">文物圖鑑</span><span class="book about-us">鑑定遊戲</span><span class="book contact">社群交流</span><span class="book faq">典藏商城</span><span class="book not-found"></span><span class="door left"></span><span class="door right"></span></div></div><span class="shelf-caption">這裡，少了你要找的那一頁。</span></div>
    <div class="lost-page__content"><div class="lost-page__copy"><h1 id="not-found-title">你可能走錯位置了</h1><p><span>這個網址沒有對應的頁面，</span><span>可能是連結已更換，</span><span>或網址輸入有誤。</span></p><p><span>請回到首頁，</span><span>或從下方連結繼續瀏覽。</span></p><code>{{ path }}</code></div>
    <a class="home-link" routerLink="/home"><app-qmah-icon name="home" [size]="19" />回到首頁</a>
    <nav aria-label="繼續探索"><a routerLink="/artifact-list">文物圖鑑</a><a routerLink="/game">鑑定遊戲</a><a routerLink="/store">典藏商城</a></nav></div>
  </section>`,
})
export class NotFoundComponent { readonly path = inject(Router).url.split(/[?#]/)[0]; }
