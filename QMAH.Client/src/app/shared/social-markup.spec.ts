import { describe, expect, it } from 'vitest';

import { parseSocialInline, stripSocialMarkup } from './social-markup';

describe('social markup', () => {
  it('解析粗體、斜體、字級與顏色，並可巢狀', () => {
    expect(parseSocialInline('a **b** *c*')).toEqual([
      { text: 'a ' }, { text: 'b', bold: true }, { text: ' ' }, { text: 'c', italic: true },
    ]);
    expect(parseSocialInline('{紅:**重點**}')).toEqual([{ text: '重點', color: 'red', bold: true }]);
    expect(parseSocialInline('{大:標題}')).toEqual([{ text: '標題', size: 'lg' }]);
  });

  it('不成對或不在白名單的標記原樣保留，HTML 一律只是文字', () => {
    expect(parseSocialInline('5 * 3 = 15').map(s => s.text).join('')).toBe('5 * 3 = 15');
    expect(parseSocialInline('{紫:x}').map(s => s.text).join('')).toBe('{紫:x}');
    const html = '<img src=x onerror=alert(1)> **b**';
    const segments = parseSocialInline(html);
    expect(segments[0].text).toBe('<img src=x onerror=alert(1)> ');
    expect(segments.every(s => !('html' in s))).toBe(true);
    // 顏色只接受白名單 key，不會出現使用者提供的 CSS。
    expect(parseSocialInline('{red;background:url(x):a}').length).toBe(1);
  });

  it('stripSocialMarkup 供摘要使用', () => {
    expect(stripSocialMarkup('**粗** {紅:紅字} *斜*')).toBe('粗 紅字 斜');
    expect(stripSocialMarkup('被截斷的 {紅:文字')).toBe('被截斷的 文字');
    expect(stripSocialMarkup(null)).toBe('');
  });
});
