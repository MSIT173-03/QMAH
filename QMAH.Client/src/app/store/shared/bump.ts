/**
 * 讓元素「放大一下再還原」（購物車件數變化、加入購物車時使用），以 Web Animations API 播放；
 * 連續呼叫時每次都從頭播放，使用者偏好減少動態或環境不支援時不播放。
 */
export function bumpElement(element: HTMLElement | null | undefined, scale = 1.6, duration = 400): void {
  if (!element || typeof element.animate !== 'function') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  element.animate(
    [{ transform: 'scale(1)' }, { transform: `scale(${scale})`, offset: 0.4 }, { transform: 'scale(1)' }],
    { duration, easing: 'ease-out' },
  );
}

/** 「加入購物車」按鈕按下時的放大動畫（商品卡片、商品橫列、商品頁共用） */
export function bumpAddToCart(element: HTMLElement | null | undefined): void {
  bumpElement(element, 1.1, 250);
}
