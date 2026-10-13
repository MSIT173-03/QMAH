// ui-integration: 看板代碼與審核／發布狀態是後端 enum，玩家不該直接看到；
// 對照表與 QMAH.Web 的 AdminDisplayLabels 保持同一組中文，前台與後台用詞一致。
const BOARD_LABELS: Record<string, string> = {
  GENERAL: '綜合交流',
  CATALOG: '文物討論',
  GAME: '鑑定遊戲',
  EVENTS: '活動消息',
  EVENT: '活動專區',
  DISCOVERY: '探索發現',
  REVIEW: '鑑賞心得',
  QUESTION: '問題求助',
  GUIDE: '研究筆記',
  STORE: '商城活動',
};

// 看板分三族，導覽依此分組、同族同色（顏色見 styles.scss 的 --board-c）。API 回來但不在表內的看板歸「其他」。
export interface BoardGroup { key: string; label: string; boards: string[] }

const BOARD_GROUPS: readonly BoardGroup[] = [
  { key: 'knowledge', label: '鑑賞知識', boards: ['CATALOG', 'DISCOVERY', 'REVIEW', 'GUIDE'] },
  { key: 'event', label: '活動與商城', boards: ['EVENT', 'EVENTS', 'STORE'] },
  { key: 'social', label: '交流互動', boards: ['GENERAL', 'QUESTION', 'GAME'] },
];

export function groupBoards(codes: readonly string[]): BoardGroup[] {
  const present = new Set(codes.map(code => code.toUpperCase()));
  const known = new Set(BOARD_GROUPS.flatMap(group => group.boards));
  const groups = BOARD_GROUPS.map(group => ({ ...group, boards: group.boards.filter(code => present.has(code)) }));
  const other = codes.filter(code => !known.has(code.toUpperCase()));
  if (other.length) groups.push({ key: 'other', label: '其他', boards: other });
  return groups.filter(group => group.boards.length);
}

// 活動參加方式沒有獨立欄位，沿用地點文字判斷：「線上活動」是純線上；地點同時寫了場館與「線上」字樣（例如「…（線上同步直播）」）是兩者皆可；其餘為實體。
// ponytail: 靠文字約定，之後若活動管理要能單獨切換，再補 AttendanceMode 欄位。
export type EventModeKey = 'online' | 'hybrid' | 'offline';
export interface EventMode { key: EventModeKey; label: string }

export function eventMode(location: string | null | undefined): EventMode | null {
  const text = location?.trim();
  if (!text) return null;
  if (text.startsWith('線上')) return { key: 'online', label: '線上參加' };
  if (text.includes('線上')) return { key: 'hybrid', label: '線上線下皆可' };
  return { key: 'offline', label: '現場參加' };
}

/** 去掉地點尾端的「（線上同步直播）」這類說明，只留場館與地址；純線上活動回傳空字串（由參加方式標籤表示）。 */
export function eventPlace(location: string | null | undefined): string {
  const text = location?.trim() ?? '';
  if (text.startsWith('線上')) return '';
  return text.replace(/[（(][^）)]*線上[^）)]*[）)]\s*$/, '').trim();
}

const REVIEW_STATUS_LABELS: Record<string, string> = {
  PENDING: '待審核',
  APPROVED: '已核准',
  REJECTED: '已駁回',
};

const PUBLISH_STATUS_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  PUBLISHED: '已發布',
  CANCELLED: '已取消',
};

function lookup(table: Record<string, string>, code: string | null | undefined, fallback: string): string {
  const key = code?.trim().toUpperCase();
  return key && table[key] ? table[key] : fallback;
}

/** 未知看板退回「其他分類」，不把英文代碼直接丟給玩家。 */
export function boardLabel(code: string | null | undefined): string {
  return lookup(BOARD_LABELS, code, '其他分類');
}

export function reviewStatusLabel(code: string | null | undefined): string {
  return lookup(REVIEW_STATUS_LABELS, code, '審核中');
}

export function publishStatusLabel(code: string | null | undefined): string {
  return lookup(PUBLISH_STATUS_LABELS, code, '未發布');
}
