// artifact-unlock-model.ts
//
// 更新紀錄：
// 原本 ArtifactDetail 裡的 unifiedNumber / workNumber / title / titleEn /
// authorName / creationPeriod / quantity 是先前憑印象猜的欄位；實際打過
// GET /catalog/artifacts/{id} 之後發現後端根本沒有這些欄位，真正多出來的是
// eraTextOriginal / creatorDisplay / description / sizeText /
// primaryImagePath / sourceUrl / licenseCode / attributionText。
// 現在改成從 catalog-model.ts 的 CatalogDetailModel 衍生出 ArtifactDetail，
// 兩邊欄位永遠同步，不用再手動維護第二份定義。
//
// 另外，圖鑑「清單」畫面（一次 20 筆）不需要、也不該預先打 20 次詳細 API，
// 所以把卡片拆成兩層：
//   CompendiumCardSummary：清單資料（CatalogModel）+ 外皮 + 解鎖狀態，格狀列表用。
//   CardEntry           ：CompendiumCardSummary 再疊上 ArtifactDetail，
//                         使用者點開卡片、呼叫 getArtifactDetail 之後才組得出來。

import { CatalogModel, CatalogDetailModel } from './catalog-model';

/** 圖鑑卡面的遊戲化外皮（收藏卡呈現用，非文物真實資訊，目前後端沒有對應欄位，暫由前端提供） */
export interface CompendiumSkin {
  emoji: string;
  color: string; // 卡面主色，供 CSS 變數 --card-color 使用
  type: string; // 屬性徽章（例如：火／水／草...）
  rarity: string; // 星等字串，同時作為解鎖所需鑰匙數的依據
  habitat: string;
  desc: string;
}

/**
 * 解鎖後於資訊面板顯示的文物詳細資料。
 * 直接取 CatalogDetailModel 扣掉 CatalogModel 已有欄位的差集，
 * 保證跟 GET /catalog/artifacts/{id} 的真實回應一致。
 */
export type ArtifactDetail = Omit<CatalogDetailModel, keyof CatalogModel>;

/**
 * 圖鑑清單卡片：只需要清單 API（CatalogModel）+ 遊戲外皮 + 解鎖狀態，
 * 用於格狀列表畫面。此時尚未呼叫過 /catalog/artifacts/{id}，
 * 因此不含 ArtifactDetail 欄位。
 */
export interface CompendiumCardSummary extends CatalogModel, CompendiumSkin {
  unlocked: boolean;
  unlockedAt: string | null; // ISO 字串，由 ArtifactUnlocks 流水回填；未解鎖或無紀錄則為 null
}

/**
 * 完整卡片：CompendiumCardSummary 再疊上 ArtifactDetail。
 * 對應「點開卡片 / 解鎖後顯示資訊面板」這個時機才會組出來的完整資料。
 */
export interface CardEntry extends CompendiumCardSummary, ArtifactDetail {}

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

/**
 * 解鎖 API 的回應形狀：後端在同一交易內完成扣鑰匙、寫入流水後，一併回傳。
 * ⚠️ item 型別雖然是 CardEntry，但後端不會知道 emoji/color/rarity 這些
 * 前端專屬的外皮欄位——串接 unlockByKey 時，記得用本地的外皮資料
 * 疊上後端回應再組成 CardEntry，不要直接把 http 回應斷言成 CardEntry。
 */
export interface UnlockResult {
  item: CardEntry;
  record: ArtifactUnlockRecord;
  remainingKeys: number;
}
