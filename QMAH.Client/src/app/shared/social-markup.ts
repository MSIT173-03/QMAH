/**
 * 社群貼文的行內格式：貼文仍以純文字儲存（API 契約不變），顯示時才轉成「文字片段」，
 * 並以 Angular 文字插值輸出，絕不使用 innerHTML，所以使用者輸入的 <script>、<img onerror> 等一律只會當成文字顯示。
 *
 * 語法（可巢狀）：
 *   **粗體**　*斜體*　{大:大字}　{小:小字}　{紅:文字}（顏色限白名單：紅 棕 綠 藍 金 灰）
 */
export type SocialSize = 'lg' | 'sm';
export type SocialColor = 'red' | 'brown' | 'green' | 'blue' | 'gold' | 'gray';

export interface SocialSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  size?: SocialSize;
  color?: SocialColor;
}

type Style = Omit<SocialSegment, 'text'>;

const BRACE_KEYS: Record<string, Style> = {
  大: { size: 'lg' },
  小: { size: 'sm' },
  紅: { color: 'red' },
  棕: { color: 'brown' },
  綠: { color: 'green' },
  藍: { color: 'blue' },
  金: { color: 'gold' },
  灰: { color: 'gray' },
};

export const SOCIAL_COLORS: readonly { key: string; color: SocialColor; label: string }[] = [
  { key: '紅', color: 'red', label: '紅色' },
  { key: '棕', color: 'brown', label: '棕色' },
  { key: '綠', color: 'green', label: '綠色' },
  { key: '藍', color: 'blue', label: '藍色' },
  { key: '金', color: 'gold', label: '金色' },
  { key: '灰', color: 'gray', label: '灰色' },
];

const BOLD = /\*\*(?!\s)([\s\S]+?)(?<!\s)\*\*/;
const ITALIC = /(?<!\*)\*(?!\*|\s)([\s\S]+?)(?<![\s*])\*(?!\*)/;
const BRACE = /\{(大|小|紅|棕|綠|藍|金|灰):([^{}]+)\}/;
const MAX_DEPTH = 6;

/** 把一行文字轉成片段；無法成對的標記會原樣當文字保留。 */
export function parseSocialInline(text: string, style: Style = {}, depth = 0): SocialSegment[] {
  if (!text) return [];
  if (depth > MAX_DEPTH) return [{ text, ...style }];

  const candidates: { index: number; length: number; inner: string; apply: Style }[] = [];
  const bold = BOLD.exec(text);
  if (bold) candidates.push({ index: bold.index, length: bold[0].length, inner: bold[1], apply: { bold: true } });
  const italic = ITALIC.exec(text);
  if (italic) candidates.push({ index: italic.index, length: italic[0].length, inner: italic[1], apply: { italic: true } });
  const brace = BRACE.exec(text);
  if (brace) candidates.push({ index: brace.index, length: brace[0].length, inner: brace[2], apply: BRACE_KEYS[brace[1]] });

  if (!candidates.length) return [{ text, ...style }];

  // 同位置時粗體（**）優先於斜體（*）。
  candidates.sort((a, b) => a.index - b.index || b.length - a.length);
  const hit = candidates[0];
  const result: SocialSegment[] = [];
  if (hit.index > 0) result.push({ text: text.slice(0, hit.index), ...style });
  result.push(...parseSocialInline(hit.inner, { ...style, ...hit.apply }, depth + 1));
  result.push(...parseSocialInline(text.slice(hit.index + hit.length), style, depth));
  return result;
}

/** 移除格式標記，供列表摘要等純文字場合使用（伺服器截斷造成的殘缺標記也一併清掉）。 */
export function stripSocialMarkup(text: string | null | undefined): string {
  if (!text) return '';
  return parseSocialInline(text)
    .map(segment => segment.text)
    .join('')
    .replace(/\{(?:大|小|紅|棕|綠|藍|金|灰):/g, '')
    .replace(/\*\*/g, '');
}
