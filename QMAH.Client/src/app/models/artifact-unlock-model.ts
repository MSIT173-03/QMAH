// artifact-unlock-model.ts
//
// 已對照過 catalog-model.ts 的實際內容：
// CatalogModel 只有 id / artifactRef / name / categoryCode / categoryName /
// eraCode / eraName / thumbnailPath / hasQuestionEntry / hasShopProduct，
// 沒有 unifiedNumber / authorName / creationPeriod 這類鑑賞詳情欄位，
// 也沒有遊戲外皮（emoji/color/rarity...）或解鎖狀態欄位，
// 所以下面的 CompendiumSkin / ArtifactDetail 是真的需要、而不是重複定義。
// CatalogListResponse.items 就是分頁陣列欄位，已同步更新 service／元件的存取方式。

import { CatalogModel } from './catalog-model';

/** 圖鑑卡面的遊戲化外皮（收藏卡呈現用，非文物真實資訊，目前後端沒有對應欄位，暫由前端提供） */
export interface CompendiumSkin {
  emoji: string;
  color: string; // 卡面主色，供 CSS 變數 --card-color 使用
  type: string; // 屬性徽章（例如：火／水／草...）
  rarity: string; // 星等字串，同時作為解鎖所需鑰匙數的依據
  habitat: string;
  desc: string;
}

/** 解鎖後於資訊面板顯示的文物詳細資料；CatalogModel 目前沒有這些欄位，所以獨立存放 */
export interface ArtifactDetail {
  unifiedNumber: string; // 文物統一編號
  workNumber: string; // 作品號
  title: string; // 品名（中文）
  titleEn: string; // 品名（英文），無則為空字串
  authorName: string; // 作者
  creationPeriod: string; // 創作時間
  quantity: string; // 數量
  sourceUrl: string | null; // 來源（例如故宮典藏頁面連結）
}

/** 圖鑑清單單一項目：真實文物資料（CatalogModel）+ 遊戲外皮 + 詳細資訊 + 解鎖狀態 */
export interface CardEntry extends CatalogModel, CompendiumSkin, ArtifactDetail {
  unlocked: boolean;
  unlockedAt: string | null; // ISO 字串，由 ArtifactUnlocks 流水回填；未解鎖或無紀錄則為 null
}

/** 對應 [catalog].[ArtifactUnlocks] 的 CHECK 限制：UnlockMethod IN ('ADMIN','KEY','GAME') */
export type UnlockMethod = 'ADMIN' | 'KEY' | 'GAME';

/** 對應 [catalog].[ArtifactUnlocks] 資料表結構 */
export interface ArtifactUnlockRecord {
  id: string; // Id UNIQUEIDENTIFIER
  userId: string; // UserId UNIQUEIDENTIFIER
  artifactId: string; // ArtifactId UNIQUEIDENTIFIER，對應 CardEntry.id
  unlockMethod: UnlockMethod;
  gameRoundId: string | null;
  keyTransactionId: string | null;
  unlockedAt: string; // DATETIME2(3)，ISO 字串
}

/** 解鎖 API 的回應形狀：後端在同一交易內完成扣鑰匙、寫入流水後，一併回傳 */
export interface UnlockResult {
  item: CardEntry;
  record: ArtifactUnlockRecord;
  remainingKeys: number;
}
