import { CatalogModel, CatalogDetailModel } from './catalog-model';

/** 圖鑑卡面的遊戲化外皮（僅供遊戲呈現，非文物真實資訊，目前後端沒有對應欄位，暫由前端提供） */
export interface CompendiumSkin {
  color: string; // 卡面主色，供 CSS 變數 --card-color 使用
  type: string; // 屬性徽章
  rarity: string; // 星等字串
  habitat: string;
  desc: string;
}

/** 格狀列表用的卡片摘要：真實文物基本欄位（CatalogModel）+ 遊戲外皮 + 解鎖狀態，不含鑑賞細節 */
export interface CompendiumCardSummary extends CatalogModel, CompendiumSkin {
  unlocked: boolean;
  unlockedAt: string | null; // ISO 字串，由 ArtifactUnlocks 流水回填；未解鎖或無紀錄則為 null
}

/** 放大檢視「完整」資料：清單摘要 + 已載入的鑑賞細節（CatalogDetailModel） */
export interface CardEntry extends CompendiumCardSummary, CatalogDetailModel { }

/** 對應 [catalog].[ArtifactUnlocks] 的 CHECK 限制：UnlockMethod IN ('ADMIN','KEY','GAME') */
export type UnlockMethod = 'ADMIN' | 'KEY' | 'GAME';

/** 對應 [catalog].[ArtifactUnlocks] 資料表結構 */
/**
 * 對應 GET /me/unlocks（分頁 API）回傳的 MemberArtifactUnlockDto。
 * - keyCode／keyName 只有透過鑰匙解鎖（unlockMethod === 'KEY'）時才會有值，
 *   ADMIN／GAME 這兩種方式沒有對應的 KeyTransaction，所以是 null。
 */
export interface ArtifactUnlockRecord {
  id: string;
  artifactId: string;
  artifactRef: string;
  artifactName: string;
  categoryCode: string;
  categoryName: string;
  eraCode: string;
  eraName: string;
  unlockMethod: UnlockMethod;
  gameRoundId: string | null;
  keyTransactionId: string | null;
  keyCode: string | null;
  keyName: string | null;
  unlockedAt: string; // ISO 字串
}
