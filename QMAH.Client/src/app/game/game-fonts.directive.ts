import { DOCUMENT } from '@angular/common';
import { Directive, inject } from '@angular/core';

@Directive({ selector: '[appGameFonts]' })
export class GameFontsDirective {
  constructor() {
    const document = inject(DOCUMENT);
    // 進入遊戲才載入字體宣告，避免其他頁面多載入繁中文字型的分片索引
    if (document.getElementById('qmah-game-fonts')) return;
    const stylesheet = document.createElement('link');
    stylesheet.id = 'qmah-game-fonts';
    stylesheet.rel = 'stylesheet';
    stylesheet.href = '/assets/game/fonts/chiron-goround-tc/font.css';
    document.head.append(stylesheet);
  }
}
