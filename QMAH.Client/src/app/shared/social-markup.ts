/**
 * 社群貼文的格式標記（類似巴哈姆特／論壇的 BBCode，但不是 HTML）。
 * 貼文以純文字儲存；顯示時前端把標記解析成「節點樹」，再用 Angular 範本輸出元素與文字插值，
 * 絕不使用 innerHTML，所以使用者輸入的 <script>、<img onerror> 等一律只會被當成文字。
 * 後端有對應的 SocialMarkup（QMAH.Api/Services/SocialMarkup.cs），語法與白名單必須保持一致。
 *
 * 支援的標記（不分大小寫，可巢狀；不成對的標記會自動補齊，未知標記原樣顯示）：
 *   [b]粗體[/b]  [i]斜體[/i]  [u]底線[/u]  [s]刪除線[/s]
 *   [size=small]小字[/size]  [size=large]大字[/size]  [size=xlarge]特大字[/size]
 *   [color=red|brown|green|blue|gold|gray]彩色[/color]
 *   [h]小標題[/h]  [quote]引用[/quote]  [list][*]項目[*]項目[/list]  [center]置中[/center]
 *   [spoiler]劇透[/spoiler]  [url=https://…]連結文字[/url]（只允許 http／https）  [hr]分隔線
 */
export type SocialSize = 'small' | 'large' | 'xlarge';
export type SocialColor = 'red' | 'brown' | 'green' | 'blue' | 'gold' | 'gray';

export type SocialNode =
  | { t: 'text'; v: string }
  | { t: 'el'; n: SocialTagName; a?: string; c: SocialNode[]; items?: SocialNode[][] };

export type SocialTagName = 'b' | 'i' | 'u' | 's' | 'h' | 'quote' | 'list' | 'size' | 'color' | 'url' | 'center' | 'spoiler' | 'hr';

export const SOCIAL_SIZES: readonly SocialSize[] = ['small', 'large', 'xlarge'];
export const SOCIAL_COLORS: readonly { color: SocialColor; label: string }[] = [
  { color: 'red', label: '紅色' },
  { color: 'brown', label: '棕色' },
  { color: 'green', label: '綠色' },
  { color: 'blue', label: '藍色' },
  { color: 'gold', label: '金色' },
  { color: 'gray', label: '灰色' },
];

const BLOCK_TAGS = new Set<string>(['h', 'quote', 'list', 'center', 'spoiler']);
const TAG = /\[(\/?)(b|i|u|s|h|quote|list|size|color|url|center|spoiler|hr|\*)(?:=([^\]\s]{1,300}))?\]/gi;
const MAX_DEPTH = 8;
const MAX_NODES = 4000;

/** 連結只允許 http／https，且不含會破壞屬性的字元；與後端 SocialMarkup.IsSafeUrl 相同規則。 */
export function isSafeSocialUrl(url: string | undefined): boolean {
  if (!url || url.length > 300 || !/^https?:\/\//i.test(url) || /[<>"'`\\]/.test(url)) return false;
  try {
    return !!new URL(url).host;
  } catch {
    return false;
  }
}

function validArg(name: string, arg: string | undefined): boolean {
  if (name === 'size') return !!arg && (SOCIAL_SIZES as readonly string[]).includes(arg);
  if (name === 'color') return !!arg && SOCIAL_COLORS.some(c => c.color === arg);
  if (name === 'url') return isSafeSocialUrl(arg);
  return !arg;
}

/** 舊版貼文使用的行首標記（【小標】、• 項目、> 引用、「引用」），轉成標記語法後一起解析。 */
export function legacyToMarkup(content: string): string {
  const lines = content.split('\n');
  const out: string[] = [];
  let inList = false;
  const closeList = () => {
    if (inList) { out.push('[/list]'); inList = false; }
  };
  for (const line of lines) {
    const text = line.trim();
    if (text.startsWith('• ')) {
      if (!inList) { out.push('[list]'); inList = true; }
      out.push('[*]' + text.slice(2));
      continue;
    }
    closeList();
    if (text.length >= 2 && text.startsWith('【') && text.endsWith('】')) out.push('[h]' + text.slice(1, -1) + '[/h]');
    else if (text.startsWith('> ')) out.push('[quote]' + text.slice(2) + '[/quote]');
    else if (text.length >= 2 && text.startsWith('「') && text.endsWith('」')) out.push('[quote]' + text.slice(1, -1) + '[/quote]');
    else out.push(line);
  }
  closeList();
  return out.join('\n');
}

/** 把含標記的文字解析成節點樹；任何輸入都不會丟例外。 */
export function parseSocialMarkup(source: string | null | undefined): SocialNode[] {
  const input = legacyToMarkup(source ?? '');
  const root: { c: SocialNode[] } = { c: [] };
  type Frame = { n: SocialTagName; a?: string; c: SocialNode[]; items: SocialNode[][] | null; marked: boolean };
  const stack: Frame[] = [];
  let nodeCount = 0;

  const current = (): SocialNode[] => (stack.length ? stack[stack.length - 1].c : root.c);
  const pushText = (value: string) => {
    if (!value) return;
    const target = current();
    const last = target[target.length - 1];
    if (last && last.t === 'text') last.v += value;
    else { target.push({ t: 'text', v: value }); nodeCount++; }
  };
  const finishItem = (frame: Frame) => {
    if (!frame.items) return;
    if (frame.marked) frame.items.push(frame.c);
    frame.c = [];
  };
  const close = () => {
    const frame = stack.pop()!;
    const node: SocialNode = { t: 'el', n: frame.n, a: frame.a, c: frame.c };
    if (frame.items) node.items = frame.items;
    current().push(node);
  };

  let cursor = 0;
  TAG.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG.exec(input)) && nodeCount < MAX_NODES) {
    const [raw, slash, nameRaw, arg] = match;
    const name = nameRaw.toLowerCase();
    pushText(input.slice(cursor, match.index));
    cursor = match.index + raw.length;

    if (name === '*') {
      const list = stack.length ? stack[stack.length - 1] : null;
      if (!slash && list?.n === 'list' && list.items) {
        // 新項目：把目前累積的內容收成上一個項目（第一個 [*] 之前的文字丟棄）。
        finishItem(list);
        list.marked = true;
      } else pushText(raw);
      continue;
    }

    if (name === 'hr') {
      if (slash || arg) pushText(raw);
      else { current().push({ t: 'el', n: 'hr', c: [] }); nodeCount++; if (input[cursor] === '\n') cursor++; }
      continue;
    }

    if (slash) {
      const at = stack.map(f => f.n).lastIndexOf(name as SocialTagName);
      if (at < 0) { pushText(raw); continue; }
      while (stack.length - 1 > at) close();
      const top = stack[stack.length - 1];
      finishItem(top);
      close();
      // 區塊標籤後面緊接的換行不另外產生空行。
      if (BLOCK_TAGS.has(name) && input[cursor] === '\n') cursor++;
      continue;
    }

    const normalizedArg = name === 'url' ? arg : arg?.toLowerCase();
    if (!validArg(name, normalizedArg) || stack.length >= MAX_DEPTH) { pushText(raw); continue; }
    const frame: Frame = { n: name as SocialTagName, a: normalizedArg, c: [], items: name === 'list' ? [] : null, marked: false };
    stack.push(frame);
    nodeCount++;
    if (BLOCK_TAGS.has(name) && input[cursor] === '\n') cursor++;
  }
  pushText(input.slice(cursor));
  while (stack.length) {
    const top = stack[stack.length - 1];
    finishItem(top);
    close();
  }
  return root.c;
}

function plain(nodes: SocialNode[]): string {
  return nodes
    .map(node => {
      if (node.t === 'text') return node.v;
      if (node.n === 'hr') return ' ';
      if (node.items) return node.items.map(item => plain(item).trim()).filter(Boolean).join(' ');
      return plain(node.c);
    })
    .join('');
}

/** 移除所有標記，供列表摘要等純文字場合使用（含被截斷而殘缺的標記）。 */
export function stripSocialMarkup(text: string | null | undefined): string {
  if (!text) return '';
  return plain(parseSocialMarkup(text)).replace(/\s*\n\s*/g, ' ').trim();
}
