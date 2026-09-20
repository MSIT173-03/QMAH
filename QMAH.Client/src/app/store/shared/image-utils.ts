/**
 * 商品清單先使用 API 提供的 thumbnail；若部署中的媒體目錄尚未產生縮圖，
 * 元件會再嘗試同一件文物的 display 圖，避免把不存在的圖片誤顯示成商品佔位符。
 */
export function toDisplayImage(path: string | null): string | null {
  return path?.replace(/\/thumbnail\.jpg(\?.*)?$/i, '/display.jpg$1') ?? null;
}
