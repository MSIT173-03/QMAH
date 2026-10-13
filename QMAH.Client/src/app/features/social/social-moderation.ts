import { HttpErrorResponse } from '@angular/common/http';

// 後端擋下內容時回 400 並附上原因（禁用字詞、重複過多），這裡取出來直接給使用者看，
// 其餘的 400 仍沿用各頁原本的通用錯誤訊息。
const BLOCK_TITLES = ['內容包含禁用字詞', '內容重複過多'];

export function moderationMessage(err: HttpErrorResponse): string | null {
  const body = err.error as { title?: string; detail?: string } | null;
  return err.status === 400 && body?.title && BLOCK_TITLES.includes(body.title) ? (body.detail ?? body.title) : null;
}
