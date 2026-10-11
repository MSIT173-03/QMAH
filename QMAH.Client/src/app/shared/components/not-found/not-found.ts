import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { QmahIconComponent } from '../qmah-icon/qmah-icon';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, QmahIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./missing-book.vendor.css', './not-found.scss'],
  template: `<section class="lost-page" aria-labelledby="not-found-title">
    <div class="shelf-stage" aria-hidden="true"><div class="shelf"><span class="book home-page">文物圖鑑</span><span class="book about-us">鑑定遊戲</span><span class="book contact">社群交流</span><span class="book faq">典藏商城</span><span class="book not-found"></span><span class="door left"></span><span class="door right"></span></div></div>
    <div class="lost-page__copy"><span class="error-code">404</span><h1 id="not-found-title">你可能走錯位置了</h1><p>像書架上缺了一本書，這個網址找不到對應的頁面。<br />回到首頁，繼續探索文物與故事。</p><code>{{ path }}</code></div>
    <a class="home-link" routerLink="/home"><app-qmah-icon name="home" [size]="19" />回到首頁</a>
    <nav aria-label="繼續探索"><a routerLink="/artifact-list">文物圖鑑</a><a routerLink="/game">鑑定遊戲</a><a routerLink="/store">典藏商城</a></nav>
  </section>`,
})
export class NotFoundComponent { readonly path = inject(Router).url.split(/[?#]/)[0]; }
