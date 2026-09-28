import { linkedSignal } from '@angular/core';

/**
 * 商品清單先使用 API 提供的 thumbnail；若部署中的媒體目錄尚未產生縮圖，
 * 元件會再嘗試同一件文物的 display 圖，避免把不存在的圖片誤顯示成商品佔位符。
 */
export function toDisplayImage(path: string | null): string | null {
  return path?.replace(/\/thumbnail\.jpg(\?.*)?$/i, '/display.jpg$1') ?? null;
}

/**
 * 商品縮圖的讀取狀態（商品卡片、商品橫列、購物車行共用）。
 * src 為目前實際嘗試中的圖片網址，來源更換時重設；讀取失敗時先 fallback 到同一件文物的 display 圖，
 * 仍失敗才設為 null 顯示佔位狀態，避免誤顯示其他商品的圖片。
 */
export function imageWithFallback(source: () => string | null) {
  const src = linkedSignal(source);
  return {
    src: src.asReadonly(),
    /** 綁定於 <img> 的 error 事件 */
    onError: () => {
      const current = src();
      const display = toDisplayImage(current);
      src.set(display && display !== current ? display : null);
    },
  };
}
