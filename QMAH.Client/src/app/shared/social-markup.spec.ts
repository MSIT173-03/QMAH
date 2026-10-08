import { describe, expect, it } from 'vitest';

import { parseSocialMarkup, stripSocialMarkup, SocialNode } from './social-markup';

const el = (nodes: SocialNode[], i = 0) => nodes[i] as Extract<SocialNode, { t: 'el' }>;

describe('social markup (BBCode 風格)', () => {
  it('解析粗體、斜體、字級、顏色，並可巢狀', () => {
    const nodes = parseSocialMarkup('a [b]粗[i]粗斜[/i][/b] [color=red][size=large]紅大[/size][/color]');
    expect(nodes[0]).toEqual({ t: 'text', v: 'a ' });
    expect(el(nodes, 1).n).toBe('b');
    expect(el(el(nodes, 1).c, 1).n).toBe('i');
    expect(el(nodes, 3).n).toBe('color');
    expect(el(nodes, 3).a).toBe('red');
    expect(el(el(nodes, 3).c, 0).a).toBe('large');
  });

  it('不成對的標記自動補齊，多餘的結束標記與未知標記原樣顯示', () => {
    expect(stripSocialMarkup('[b]沒關')).toBe('沒關');
    expect(stripSocialMarkup('多餘[/b]')).toBe('多餘[/b]');
    expect(stripSocialMarkup('[color=purple]x[/color]')).toBe('[color=purple]x[/color]');
    expect(stripSocialMarkup('[url=javascript:alert(1)]點[/url]')).toBe('[url=javascript:alert(1)]點[/url]');
  });

  it('清單與區塊標籤', () => {
    const nodes = parseSocialMarkup('[list]\n[*]一\n[*]二\n[/list]\n[h]標題[/h]\n[quote]引[/quote]');
    expect(el(nodes, 0).n).toBe('list');
    expect(el(nodes, 0).items?.length).toBe(2);
    expect(el(nodes, 1).n).toBe('h');
    expect(el(nodes, 2).n).toBe('quote');
  });

  it('舊版行首標記仍可顯示', () => {
    const nodes = parseSocialMarkup('【小標】\n• 甲\n• 乙\n「引用」');
    expect(nodes.map(n => (n.t === 'el' ? n.n : 'text'))).toEqual(['h', 'list', 'quote']);
  });

  it('HTML 只會是文字，不會變成節點或屬性', () => {
    const html = '<img src=x onerror=alert(1)> [b]x[/b]';
    const nodes = parseSocialMarkup(html);
    expect(nodes[0]).toEqual({ t: 'text', v: '<img src=x onerror=alert(1)> ' });
    expect(JSON.stringify(nodes)).not.toContain('"onerror"');
    expect(stripSocialMarkup('[color=red;background:url(x)]a[/color]')).toContain('[color=red;background:url(x)]');
  });

  it('stripSocialMarkup 供摘要使用，被截斷的標記不會殘留', () => {
    expect(stripSocialMarkup('[b]粗[/b] [color=red]紅字[/color] [i]斜[/i]')).toBe('粗 紅字 斜');
    expect(stripSocialMarkup('被截斷的 [color=red]文字')).toBe('被截斷的 文字');
    expect(stripSocialMarkup(null)).toBe('');
  });

  it('極端輸入不會丟例外', () => {
    expect(() => parseSocialMarkup('[b]'.repeat(5000))).not.toThrow();
    expect(() => parseSocialMarkup('[*][*][/list][list][*]')).not.toThrow();
  });
});
