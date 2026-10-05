// ui-integration: 看板代碼與審核／發布狀態是後端 enum，玩家不該直接看到；
// 對照表與 QMAH.Web 的 AdminDisplayLabels 保持同一組中文，前台與後台用詞一致。
const BOARD_LABELS: Record<string, string> = {
  GENERAL: '綜合交流',
  CATALOG: '文物討論',
  GAME: '鑑定遊戲',
  EVENTS: '活動消息',
  EVENT: '活動',
  DISCOVERY: '探索發現',
  REVIEW: '鑑賞心得',
  QUESTION: '問題求助',
  GUIDE: '研究筆記',
  STORE: '商城活動',
};

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
