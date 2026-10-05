import { ElementRef, Signal, effect, signal } from '@angular/core';

/**
 * 量測 CSS grid 容器目前有幾欄，並隨容器寬度變化更新。
 * 商品卡片格狀是 auto-fill 的，欄數取決於容器寬度；要「固定顯示 N 行」就必須知道欄數，
 * 再用 `items.slice(0, 欄數 * N)` 決定實際渲染哪些項目（超出的項目不渲染，也不會被鍵盤聚焦到）。
 *
 * 須於注入環境中呼叫（例如元件欄位初始化）。容器尚未渲染（或還沒量到）時回傳 `Infinity`，
 * 也就是先不限制，量到之後在同一輪變更偵測內就會收斂，不會閃爍。
 */
export function gridColumns(grid: Signal<ElementRef<HTMLElement> | undefined>): Signal<number> {
  const columns = signal(Infinity);

  effect((onCleanup) => {
    const element = grid()?.nativeElement;
    if (!element) return;

    const update = () => {
      // 計算後的 grid-template-columns 是各欄實際寬度（例如 "190px 190px 190px"），欄數即其項目數。
      const tracks = getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean);
      if (tracks.length > 0) columns.set(tracks.length);
    };
    update();

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(element);
    onCleanup(() => observer?.disconnect());
  });

  return columns.asReadonly();
}
