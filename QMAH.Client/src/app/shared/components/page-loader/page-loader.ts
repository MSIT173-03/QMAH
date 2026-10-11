import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-page-loader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="page-loader" role="status" aria-live="polite"><div class="loader-inner"><div class="loader-mark" aria-hidden="true"><div class="sk-fading-circle">@for (dot of dots; track dot) { <span [style.transform]="'rotate(' + dot * 30 + 'deg)'" [style.--delay]="dot * 0.1 - 1.2 + 's'"></span> }</div><span class="loader-seal">鑑</span></div><p>正在準備這一頁</p><span class="loader-note">精彩內容，馬上呈現</span></div></div>`,
  styles: `
    :host { display: block; }
    .page-loader { position: fixed; inset: 72px 0 0; z-index: 120; display: grid; place-items: center; background: var(--color-surface, #fbfaf7); color: var(--color-ink, #263239); }
    .loader-inner { text-align: center; padding: 32px; }
    .loader-mark { position: relative; width: 104px; height: 104px; margin: 0 auto 28px; color: #af823a; }
    .loader-seal { position: absolute; inset: 0; display: grid; place-items: center; font-family: 'Noto Serif TC', serif; font-size: 34px; font-weight: 600; }
    .loader-inner p { margin: 0 0 10px; font-size: 20px; font-weight: 600; }
    .loader-note { color: var(--color-muted, #716a60); font-size: 14px; }
    /* Circle Fade adapted from Tobias Ahlin's MIT-licensed SpinKit. */
    .sk-fading-circle { position: relative; width: 100%; height: 100%; }
    .sk-fading-circle span { position: absolute; inset: 0; }
    .sk-fading-circle span::before { content: ''; display: block; width: 9px; height: 9px; margin: 0 auto; border-radius: 50%; background: currentColor; animation: qmah-circle-fade 1.2s infinite ease-in-out both; animation-delay: var(--delay); }
    @keyframes qmah-circle-fade { 0%, 39%, 100% { opacity: .15; } 40% { opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { .sk-fading-circle span::before { animation: none; opacity: .6; } }
    @media (max-width: 700px) { .page-loader { inset-block-start: 64px; } }
  `,
})
export class PageLoaderComponent { readonly dots = Array.from({ length: 12 }, (_, index) => index); }
