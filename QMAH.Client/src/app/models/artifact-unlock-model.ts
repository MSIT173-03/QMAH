// artifact-unlock-model.ts
//
// CompendiumSkin 是圖鑑卡面的遊戲化外皮，純前端資料，後端沒有對應欄位。
// CompendiumCardSummary／CardEntry 對應 artifact-list.ts 實際用到的兩層資料：
// - CompendiumCardSummary：格狀列表用，CatalogModel + 外皮 + 解鎖狀態，不含鑑賞細節
//   （避免一次把整批文物的 description/sizeText 這類較重欄位都抓回來）。
// - CardEntry：使用者點開某張卡片、鑑賞細節（CatalogDetailModel）也載入後的「完整」資料，
//   給資訊面板、放大圖、「玩家回答鑑賞」導頁使用。
//
// ⚠️ 這個檔案先前一直沒有匯出 CompendiumCardSummary，但 artifact-list.ts 早就在用它，
// 是我這邊落後於你實際專案的地方，這次一併補上、修正。

import { CatalogModel, CatalogDetailModel } from './catalog-model';

/** 圖鑑卡面的遊戲化外皮（收藏卡呈現用，非文物真實資訊，目前後端沒有對應欄位，暫由前端提供） */
export interface CompendiumSkin {
  emoji: string;
  color: string; // 卡面主色，供 CSS 變數 --card-color 使用
  type: string; // 屬性徽章（例如：火／水／草...）
  rarity: string; // 星等字串（畫面上目前不顯示星星，但欄位保留）
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
 *
 * ⚠️ 已依後端 EconomyController.GetUnlocks() 實際程式碼修正：
 * - 路徑是 /me/unlocks，不是先前猜的 /me/catalog/artifact/unlocks。
 * - 這不是資料庫原始的 ArtifactUnlocks 資料列，而是已經 join 過文物、分類、
 *   年代、使用鑰匙資訊的投影結果，也沒有 userId 欄位（這支本來就是「我自己的」
 *   解鎖紀錄，不需要）。
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
