import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import { moderationMessage } from './social-moderation';

const problem = (status: number, title: string, detail: string) =>
  new HttpErrorResponse({ status, error: { title, detail } });

describe('moderationMessage', () => {
  it('returns the server reason when content is blocked', () => {
    expect(moderationMessage(problem(400, '內容包含禁用字詞', '這篇內容包含被禁止發布的字詞，請修改後再發布。')))
      .toBe('這篇內容包含被禁止發布的字詞，請修改後再發布。');
    expect(moderationMessage(problem(400, '內容重複過多', '這則內容有大量重複的字或片段，請調整後再發布。')))
      .toBe('這則內容有大量重複的字或片段，請調整後再發布。');
  });

  it('ignores other errors so pages keep their generic message', () => {
    expect(moderationMessage(problem(400, '圖片附件無效', '請重新上傳後再試。'))).toBeNull();
    expect(moderationMessage(problem(401, '內容包含禁用字詞', 'x'))).toBeNull();
    expect(moderationMessage(new HttpErrorResponse({ status: 500 }))).toBeNull();
  });
});
